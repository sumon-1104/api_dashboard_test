# Project Status — AI API Usage Monitoring Dashboard

**Last updated:** 2026-09-16
**Overall completion: ~90% of v1 spec implemented and verified; blocked on one manual step (below) before it's live.**

This file exists so any agent (or human) picking this project up — mid-session or fresh — has the
full picture without re-deriving it from the code. Read `CLAUDE.md` for architecture/conventions and
`README.md` for setup instructions; this file is specifically "where things stand right now."

## TL;DR — what's blocking "done"

**The two SQL migrations have not been run against the real Supabase project yet.** Everything else
(all application code, all tests, build, lint, typecheck) is complete and passing. Confirmed by
querying the live project directly: `GET /rest/v1/providers` on `hlvgajhvmghxxgpubrrc` returns
`PGRST205 — Could not find the table 'public.providers'`. Until the SQL runs, the app has no schema to
talk to and nothing beyond `/login` will work end-to-end.

**Next 3 steps, in order:**
1. User runs `supabase/migrations/0001_init.sql` then `supabase/migrations/0002_functions.sql` in the
   Supabase SQL Editor for project `hlvgajhvmghxxgpubrrc` (dashboard link:
   `supabase.com/dashboard/project/hlvgajhvmghxxgpubrrc/sql/new`). Not yet confirmed done as of this
   writing — ask the user before assuming it happened.
2. Run `npm run seed` (seeds the 3 provider rows only — see `scripts/seed.ts` for why no models/pricing
   are seeded).
3. Sign up at `/login` (first account = admin, v1 has no roles), add real provider keys on
   `/dashboard/providers`, hit "Test Connection" for each.

## Environment status

`.env.local` exists (gitignored, not committed) and is filled in with **real** values already:
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` — real,
  for Supabase project `hlvgajhvmghxxgpubrrc` (owner: the user, NOT the Supabase account this
  machine's `supabase` CLI is logged into — that CLI session belongs to a different account and
  cannot `link`/`db push` to this project; confirmed via `LegacyLinkProjectStatusError`. That's why
  migration application was handed to the user manually instead of automated.)
- `ENCRYPTION_KEY` / `CRON_SECRET` — generated locally (`crypto.randomBytes(32).toString('hex')`),
  real, working.
- `SLACK_WEBHOOK_URL` — left blank (optional; alerts still work without it, just skip the Slack POST).

No provider API keys (OpenAI/Anthropic/Gemini) have been added yet — that happens through the
Providers page UI after the schema exists, not via env vars (see `CLAUDE.md` § Security rules for why).

## What's fully implemented (code-complete, tested, verified)

Everything specified in the original build prompt. Verification commands all pass as of this commit
point (re-run them after any further changes):

```bash
npm run lint        # 0 problems
npm run typecheck    # next typegen && tsc --noEmit — 0 errors
npx vitest run        # 31/31 tests passing
npm run build          # compiles, all 22 routes generate
```

### Schema (`supabase/migrations/`)
- `0001_init.sql` — 9 tables, RLS on all of them, `handle_new_user`/`set_updated_at` triggers.
- `0002_functions.sql` — 3 Postgres aggregation functions (`usage_summary_by_provider`,
  `usage_timeline`, `usage_by_model`) called via `.rpc()` so aggregation never happens in the browser.

### Provider layer (`src/lib/providers/`)
- `types.ts` — the `AIProvider` interface, `ProviderCredentialError`.
- `openai.ts`, `anthropic.ts` — real Admin Usage/Cost API clients, endpoint shapes verified against
  current docs during the build (pagination, cents-vs-dollars for Anthropic, field names).
- `gemini.ts` — connection-test + models-list only, `getUsage`/`getCost`/`getRateLimits` intentionally
  `null` (no aggregate API exists for a Gemini key — verified, not assumed).
- `registry.ts` — slug → decrypted-client factory, the only place credentials are decrypted.
- `http.ts`, `meta.ts` — shared fetch wrapper, display metadata.

### App layer
- Auth: `/login` (sign in + sign up tabs), `src/proxy.ts` (Next 16's renamed `middleware.ts`) redirects
  unauthenticated visitors away from `/dashboard/*`, `dashboard/layout.tsx` re-checks server-side.
- All 6 dashboard pages (`page.tsx`, `providers/`, `usage/`, `models/`, `limits/`, `errors/`,
  `settings/`) — see file inventory below.
- All API routes under `src/app/api/` — providers (list/patch/credentials/test), usage
  (raw/summary/timeline), models (list/patch), limits (CRUD), errors (paginated), and
  `cron/poll-usage` (the only route guarded by `CRON_SECRET` instead of session auth).
- `src/lib/usage/poll.ts` + `evaluate-alerts.ts` — the cron orchestration: polls OpenAI/Anthropic for
  "today" (UTC), replaces today's snapshot idempotently, auto-discovers models with null pricing,
  then evaluates 50/75/90/100% thresholds against `alerts`' unique constraint and fires Slack.
- `src/lib/costs/`, `src/lib/usage/remaining.ts` — cost math and the provider/application-calculated/
  unknown tri-state, exactly per spec's "never fabricate a number" rule.
- `src/lib/encryption/` — AES-256-GCM, app-side key, round-trip tested.

### Tests (`*.test.ts`, colocated with the code they test)
`costs/index.test.ts`, `encryption/index.test.ts`, `usage/remaining.test.ts`, `usage/alerts.test.ts`,
`auth/session.test.ts` (cron secret), `auth/redirect-rules.test.ts` (dashboard redirect logic) — 31
tests, all passing, run via `vitest.config.mts`.

### Docs
`README.md` (setup, provider key instructions, cron/scheduler examples, Slack webhook setup),
`CLAUDE.md` (architecture, provider abstraction contract, how to add a new provider, security/database
rules), `.env.example`.

## What's NOT done / not verified yet

1. **Migrations not run against the real project** (see TL;DR — this is the actual blocker).
2. **`npm run seed` not run yet** — depends on #1.
3. **No real provider credentials added** — OpenAI Admin key, Anthropic Admin key, Gemini key all
   still need to be pasted into `/dashboard/providers` by the user once the app is reachable.
4. **No live "Test Connection" run against a real provider** — the provider client code was verified
   against current API docs (endpoint paths, field names, auth headers) but never exercised against a
   live OpenAI/Anthropic/Gemini account, since no such credentials were available during the build.
5. **No cron scheduler wired up yet** — `POST /api/cron/poll-usage` works and was smoke-tested with
   placeholder Supabase creds (returns clean 200 with per-provider status), but no external
   scheduler (Vercel Cron / `pg_cron` / GitHub Actions) has been configured to actually call it on a
   schedule. README has copy-paste examples for both.
6. **No deployment** — this only exists locally so far (`/Users/nagorik/Sumon/ai-api-usage-dashboard`).
   Not pushed to a git remote; `git init` was run but there have been no commits (only commit when the
   user explicitly asks).
7. **Dashboard UI has not been visually exercised in a browser** — verified via `curl` (status codes,
   redirect behavior, JSON shapes) and `next build`, not via an actual browser session with real data
   flowing through the charts/tables.

## File inventory (for orientation — see `CLAUDE.md` for the annotated version)

```
supabase/migrations/0001_init.sql, 0002_functions.sql
scripts/seed.ts
src/proxy.ts
src/app/{login,dashboard,api}/**          — 21 routes/pages total
src/components/{dashboard,providers,usage,models,limits,errors,ui}/**
src/lib/{providers,usage,costs,encryption,notifications,auth,supabase}/**
src/types/database.ts
```

Run `find src -type f | sort` from the project root for the exact current file list if this drifts
out of date.

## Known gotchas worth knowing before touching this code

- **shadcn/ui here is built on `@base-ui/react`, not Radix.** No `asChild` prop on `Button` — use
  `render={<Link href="..." />}` instead (see `dashboard/errors/page.tsx` for the pattern). `Select`'s
  `onValueChange` receives `(value: string | null, eventDetails)`, not just `string` — every call site
  guards the null.
- **`Database` type in `src/types/database.ts` must use `type X = {...}`, not `interface X {...}`,
  for every table row.** An `interface` does not structurally satisfy `Record<string, unknown>` in a
  TS conditional-type "extends" check (unlike a `type` alias), which is what `SupabaseClient<Database>`
  uses internally — using `interface` silently makes every `.from(...)` call resolve to `never` with
  no obvious error pointing at the cause. Cost real time to debug once already; don't reintroduce it.
- **Next.js 16 renamed `middleware.ts` → `proxy.ts`** (exported function name `proxy`, not `default`
  necessarily but named export used here). `RouteContext<'/path'>` and `LayoutProps<'/path'>` globals
  only exist after `next dev`/`next build`/`next typegen` has run at least once — that's why
  `npm run typecheck` is `next typegen && tsc --noEmit`, not bare `tsc`.
- **`cacheComponents` (Next 16 Partial Prerendering) is deliberately left disabled** in
  `next.config.ts` — this app is 100% per-user dynamic content, so PPR's `"use cache"`/`<Suspense>`
  discipline would add complexity with zero payoff.
- **No model rows are seeded with hardcoded pricing.** Web search results for current OpenAI/Anthropic
  pricing during the build were inconsistent/unreliable (SEO/affiliate sites, conflicting numbers,
  unfamiliar model branding) — given this app's entire premise is "never fabricate a number," pricing
  is left `null` until an admin enters it from the provider's own pricing page. Don't "helpfully" add
  guessed prices to the seed script.
