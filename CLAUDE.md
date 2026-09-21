@AGENTS.md

# AI API Usage Dashboard

A poller-based dashboard that monitors real, provider-verified OpenAI/Gemini/Anthropic API usage,
cost, limits, and errors. The single rule that overrides every other convention in this file: **never
fabricate a number.** If a provider doesn't expose something, the answer is `null` and the UI says
"Not available," not an estimate.

## Project structure

```
src/
  app/
    login/                      Supabase Auth (email/password), server actions in actions.ts
    dashboard/                  protected routes (layout.tsx checks auth server-side)
      page.tsx                  Overview — project/provider filter dropdown, month-to-date summary
      projects/                 list/create projects; [projectId]/ adds providers + API keys to one
      usage/                    charts, date-range + project/provider filtered
      models/                   pricing + enable/disable per model, project/provider filtered
      limits/                   admin-configured usage_limits + provider-reported rate_limits
      errors/                   paginated api_errors table, project/provider filtered
      settings/                 Slack config status + recent alerts
    api/
      projects/                 GET list, POST create; [projectId]/providers/ nests the same
                                 GET/POST/PATCH/credentials/test routes providers/ used to own directly
      usage/                    GET raw + summary + timeline (aggregated in Postgres)
      models/                   GET list, PATCH pricing/enabled
      limits/                   GET/POST/PUT/DELETE usage_limits
      errors/                   GET paginated api_errors
      cron/poll-usage/          POST, guarded by CRON_SECRET — the only unauthenticated route
    proxy.ts                    session refresh + /dashboard auth redirect (Next 16: not middleware.ts)
  components/                   dashboard/projects/providers/usage/models/limits/errors, shadcn/ui in ui/
  lib/
    supabase/                   client.ts (browser), server.ts (RLS-scoped), admin.ts (service role)
    providers/                  the provider abstraction — see below
    costs/                      centralized cost math, never hard-coded elsewhere
    usage/                      queries (Postgres RPC wrappers), remaining-quota tri-state, alerts,
                                 the poll orchestrator, chart-data reshaping
    encryption/                 AES-256-GCM for provider_credentials
    notifications/slack.ts      sendSlackAlert()
    auth/                       requireApiUser (route handlers), requireCronSecret, redirect-rules
  types/database.ts             hand-written types mirroring supabase/migrations/*.sql
supabase/migrations/            0001_init.sql (schema+RLS) … 0005_projects.sql (projects table +
                                 per-user RLS), 0006_project_filter.sql (project/provider filter params)
```

## Projects → Providers → API keys

A **project** (`projects`, owned by `user_id`) is the top-level container a user creates first. Every
`providers` row now belongs to exactly one project (`providers.project_id`, unique per
`(project_id, slug)`) instead of being one of 3 fixed global rows — the same slug (`openai`, etc.) can
exist independently in as many projects as a user creates. Each provider row can still hold multiple
named `provider_credentials` ("keys"), unchanged from before. `lib/providers/meta.ts`'s
`PROVIDER_CATALOG` lists every provider a user can add from the Projects UI (OpenAI, Anthropic,
Gemini, Tavily, xAI, DeepSeek, Mistral, Perplexity) plus an arbitrary custom slug; only entries with
`supported: true` have a real class in `PROVIDER_FACTORIES` — the rest (and any custom slug) store a
name + key but have no live Test Connection or polling until real integration work is done for them
(never fabricate what an unimplemented provider would report).

**Ownership is real RLS now, not just "any authenticated user is an admin."** `projects.user_id` is
the root of a per-user ownership chain that flows through `providers.project_id` to every table hung
off a provider (`models`, `usage_records`, `usage_limits`, `rate_limits`, `api_errors`, `alerts`) — see
`0005_projects.sql`. `lib/providers/registry.ts` and `lib/usage/poll.ts` use the **service-role**
client and bypass this entirely (the cron poller polls every project's providers system-wide); only
browser/Server-Component reads through the regular client are ownership-scoped.

`getProviderClient`/`listProviderCredentials` take a **provider id** directly, not a bare slug — a
slug alone is no longer globally unique once providers are project-scoped, so every caller resolves
`(projectId, slug) → providerId` first (the nested `/api/projects/[projectId]/providers/[provider]/...`
routes do this from the URL) before calling into the registry.

## Provider architecture

`lib/providers/types.ts` defines the `AIProvider` interface every provider implements
(`lib/providers/<slug>.ts`):

```ts
interface AIProvider {
  slug: string;
  kind: "llm" | "search";
  testConnection(): Promise<TestConnectionResult>;
  getModels(): Promise<ProviderModel[] | null>;
  getUsage(range): Promise<UsageReport | null>;
  getCost(range): Promise<CostReport | null>;
  getBalance(): Promise<{ amount: number; currency: string } | null>;
  getRateLimits(): Promise<RateLimitEntry[] | null>;
}
```

Every method returns `null` rather than a guessed value when the provider genuinely doesn't expose
that data. `lib/providers/registry.ts` maps a provider slug to its credential's `key_type` and
instantiates the right class from a decrypted key — this is the **only** place
`provider_credentials.encrypted_api_key` is ever read (via the service-role client in
`lib/supabase/admin.ts`).

### The three v1 providers are not symmetric

- **OpenAI** (`lib/providers/openai.ts`) — real Usage/Cost Admin APIs
  (`/v1/organization/usage/completions`, `/v1/organization/costs`), require an **Admin API key**.
  No balance endpoint. No rate-limit query endpoint — those numbers only ever appear in a live call's
  `x-ratelimit-*` response headers, which this poller never generates.
- **Anthropic** (`lib/providers/anthropic.ts`) — real Usage/Cost Admin APIs
  (`/v1/organizations/usage_report/messages`, `/v1/organizations/cost_report`) plus a genuine
  Rate Limits API (`/v1/organizations/rate_limits`, *configured* limits, not a live remaining count).
  All three require an **Admin API key** (`sk-ant-admin01-...`) or an `org:admin`-scoped OAuth token.
  Data lands ~5 minutes after a request completes; Anthropic's own guidance caps sustained polling at
  once a minute. Cost API amounts are in **cents as decimal strings** — divide by 100.
- **Gemini** (`lib/providers/gemini.ts`) — **has no aggregate usage/cost/quota API as of this
  writing.** `getUsage`/`getCost`/`getRateLimits` intentionally always return `null`. The only usage
  data Google returns is the `usageMetadata` block inside a single `generateContent` response,
  captured only from the Test Connection ping (`source: 'self_logged'`), never polled. **Do not "fix"
  this by inventing an endpoint** — verify against current Gemini docs before assuming otherwise.

### `provider_polled` vs `self_logged`

`usage_records.source` distinguishes two origins that must never be conflated:

- `provider_polled` — a snapshot from a provider's own admin usage/cost API (OpenAI, Anthropic).
  Written by `lib/usage/poll.ts`, called from `POST /api/cron/poll-usage`.
- `self_logged` — usage captured from a live request this app itself made (e.g. Gemini's Test
  Connection ping reading its own `usageMetadata`).

### `llm` vs `search` provider kind

`providers.provider_kind` is a plain text column (`'llm' | 'search'`, extensible), not a fixed enum.
LLM providers get the token/model/cost panels; a search-kind provider (Tavily, when added) gets a
credits-used/credits-remaining panel with a per-endpoint breakdown instead — it has no models and no
per-token pricing. `usage_records.credits_used` and `.metadata` (jsonb) exist for this today even
though v1 doesn't populate them; `model_id` is nullable for the same reason.

### Adding a new provider (Tavily, xAI, DeepSeek, Mistral, ...)

Tavily/xAI/DeepSeek/Mistral/Perplexity already exist as `supported: false` entries in
`PROVIDER_CATALOG` (`lib/providers/meta.ts`) — a user can already add one to a project and store a
key for it today, it just has no live Test Connection/polling yet. Making one real:

1. Write `lib/providers/<slug>.ts` implementing `AIProvider`. Re-verify auth requirements and
   endpoint paths against current docs before implementing — providers change these, and are not
   symmetric with each other. As researched in September 2026: Tavily's `GET /usage` and DeepSeek's
   `GET /user/balance` both reuse the provider's **standard** key; xAI's billing endpoints need a
   separate **management** key; Mistral's usage metrics need a separate **admin** key (exact path
   unconfirmed — look it up fresh).
2. Register the slug → `key_type` mapping in `PROVIDER_KEY_TYPE`, and the slug → class mapping in
   `PROVIDER_FACTORIES`, both in `lib/providers/registry.ts`. `provider_credentials.key_type` is plain
   text, not a fixed enum — document the convention here as you add each one (`'standard'` | `'admin'`
   | `'management'`).
3. Flip `supported: true` on its `PROVIDER_CATALOG` entry in `lib/providers/meta.ts` (adding a new
   entry there first, for a provider not already in the catalog).
4. If the provider genuinely reports an account balance, implement `getBalance()` — this is what lets
   "Remaining: Provider reported" be wired to something real instead of falling through to
   "Application calculated" or "Unknown."
5. Add the slug to `POLLABLE_PROVIDER_SLUGS` in `app/api/cron/poll-usage/route.ts` only if it has a
   real usage/cost endpoint to poll (a search-kind provider like Tavily still qualifies — it has a
   real `/usage` endpoint, just credit-shaped instead of token-shaped).

No schema migration and no UI rewrite should be needed for a new `llm`-kind provider with a real
usage/cost API; the Projects UI already accepts whatever `key_type` a provider's client declares.

## Remaining usage — three states

`lib/usage/remaining.ts` — used everywhere "remaining" is shown, so the UI never presents an
application-calculated number as an official provider quota:

1. **`provider`** — a provider explicitly returned a limit/remaining pair (Anthropic's configured
   rate limits; a future `getBalance()` provider). Label: "Source: Provider."
2. **`application_calculated`** — admin-configured `usage_limits` minus tracked `usage_records`.
   Label: "Source: Application calculated."
3. **`unknown`** — neither available. This is the common case (OpenAI/Anthropic balance, all of
   Gemini). Renders "Remaining: Not available," never a blended or estimated figure.

## Cost calculation

`lib/costs/index.ts` is the only place cost math happens — never hard-code a price in a provider file
or a component. `calculateTokenCost` returns `null` ("N/A") when either price is unknown.
`resolveCost` prefers a provider's own reported cost (from its Cost API) over the calculated figure,
and always carries which source produced the number.

## Alerts

`lib/usage/alerts.ts` (pure, unit-tested) + `lib/usage/evaluate-alerts.ts` (DB-wired, called from the
cron route after every poll). Thresholds default to 50/75/90/100% used, overridable via the
`ALERT_THRESHOLD_PCTS` env var (comma-separated, e.g. `80` for a single flat threshold). De-duplication
is the part that matters: the `alerts` table has a unique constraint on
`(provider_id, limit_type, threshold_pct, period_key)`; the cron job upserts with
`ignoreDuplicates: true` and only sends Slack when the insert actually landed a new row. A new period
(`period_key` rolls over) or a higher threshold can fire again — the same one within the same period
never re-fires. Only ever evaluate thresholds against a real remaining figure — never against
`unknown`.

## Security rules

- Provider API keys (including OpenAI/Anthropic **Admin**-level keys, which have broader org access
  than a normal key) are AES-256-GCM encrypted (`lib/encryption`) with a 32-byte `ENCRYPTION_KEY` env
  var — application-side only, never `pgcrypto`, so the encryption key never touches the database.
- `provider_credentials.encrypted_api_key` is read only by `lib/supabase/admin.ts` (service-role
  client). No RLS policy grants the anon/authenticated Postgres role access to that column at all.
- Every API route except `/api/cron/poll-usage` calls `requireApiUser()` first. The cron route calls
  `requireCronSecret()` instead, comparing an `x-cron-secret` header to `CRON_SECRET`.
- Provider calls happen server-side only (`"server-only"` import at the top of every file that could
  touch a key). Never return a decrypted key to the client — only a masked preview
  (`lib/encryption#maskApiKey`).

## Database rules

- RLS is enabled on every table. v1 policy: `auth.uid() is not null` — every authenticated user is
  treated as an admin (the `profiles.role` column exists for later, unused today).
- Aggregation (`sum`/`group by`) happens in Postgres via the functions in
  `supabase/migrations/0002_functions.sql` (`usage_summary_by_provider`, `usage_timeline`,
  `usage_by_model`), called through `lib/usage/queries.ts` — never pull unbounded `usage_records` rows
  into the browser to sum client-side. `usage_records` and `api_errors` are paginated everywhere they're
  listed.
- `lib/usage/poll.ts` polls "today" (UTC) each run and **replaces** that day's `provider_polled` rows
  for the provider before inserting the fresh snapshot — the provider's usage report is a cumulative
  total for the period requested, so this keeps the poll idempotent without a unique-constraint dance.
  A model discovered in real usage data is auto-inserted into `models` with `null` pricing; nothing
  guesses a price.

## Coding conventions

- No comments explaining *what* code does — only non-obvious *why* (a provider API quirk, a specific
  field name Anthropic/OpenAI actually returns, a workaround).
- Server Components + Server Actions by default; a component is `"use client"` only when it needs
  interactivity (forms, charts, filters that use `useRouter`/`useState`).
- shadcn/ui components in `components/ui/` are generated via `npx shadcn add` and built on
  `@base-ui/react` (not Radix) — the public component API (`Select`, `SelectTrigger`, etc.) is stable
  shadcn convention, but `asChild` isn't supported; use base-ui's `render` prop
  (`<Button render={<Link href="..." />}>`) to compose a button with a link instead.
- `cacheComponents` (Next 16's Partial Prerendering) is intentionally **not** enabled in
  `next.config.ts` — every dashboard route is per-user and dynamic by nature, so the
  `"use cache"`/`<Suspense>` discipline it requires would add complexity with no payoff here.
