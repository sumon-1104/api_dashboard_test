# AI API Usage Dashboard

A small, honest dashboard for monitoring OpenAI, Google Gemini, and Anthropic Claude API usage,
tokens, cost, limits, and errors — built entirely on real, provider-verified data. It never
fabricates a number: where a provider doesn't expose something (Gemini's usage/cost/quota, OpenAI's
balance or live rate limits, Anthropic's account balance), the UI says so explicitly instead of
guessing.

See `CLAUDE.md` for architecture and coding conventions if you're extending this project.

## Architecture in one paragraph

This is a **poller**, not a proxy. On a schedule (see [Cron / scheduler setup](#cron--scheduler-setup)),
`POST /api/cron/poll-usage` calls each connected provider's own admin-level usage/cost API and stores
a snapshot in Postgres. The dashboard reads only from that snapshot — it never sits in the request
path of your other applications. OpenAI and Anthropic both have real admin usage/cost APIs; Gemini
does not, so Gemini is connection-tested only, never polled. Full detail in `CLAUDE.md`.

## Tech stack

Next.js (App Router) + TypeScript, Supabase (Postgres + Auth), Tailwind CSS + shadcn/ui, Recharts.
No separate backend, no Redis, no Docker.

## Local setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create a Supabase project

Create a project at [supabase.com](https://supabase.com) (or run one locally with the Supabase CLI).
You'll need, from **Project Settings → API**:

- Project URL → `NEXT_PUBLIC_SUPABASE_URL`
- `anon` `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `service_role` key (never expose this to the browser) → `SUPABASE_SERVICE_ROLE_KEY`

### 3. Run the migrations

Apply both files in `supabase/migrations/` in order, against your project — either paste them into
the Supabase SQL Editor, or with the Supabase CLI:

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

- `0001_init.sql` — all tables, RLS policies, triggers.
- `0002_functions.sql` — the Postgres aggregation functions the dashboard's charts and summary
  cards call via `.rpc(...)` (see `CLAUDE.md` § Database rules for why aggregation happens here and
  not in the browser).

### 4. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in:

| Variable | Where it comes from |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API. Server-side only. |
| `ENCRYPTION_KEY` | `openssl rand -hex 32` — 32 bytes, AES-256-GCM key for stored provider credentials |
| `CRON_SECRET` | `openssl rand -hex 32` — shared secret the scheduler sends to `/api/cron/poll-usage` |
| `SLACK_WEBHOOK_URL` | Optional — see [Slack alerts](#slack-alerts) |

### 5. Seed the providers

```bash
npm run seed
```

This inserts the three v1 provider rows (OpenAI, Gemini, Anthropic). It does **not** seed any model
rows or pricing — model identifiers and pricing change too often to hardcode honestly. Models appear
automatically the first time usage is polled (with pricing left `null`), or you can add one manually
on the Models page.

### 6. Run the app

```bash
npm run dev
```

Visit `http://localhost:3000`. The first visit to `/login` lets you create an account via the
"Create account" tab — every authenticated user is treated as an admin in v1 (see `CLAUDE.md`).

## Provider configuration

Go to **Dashboard → Providers** and paste in a key for each provider you want to monitor. These are
**not** the same as a normal API key for two of the three:

### OpenAI — needs an Admin API key

Regular OpenAI API keys (`sk-proj-...`) **cannot** call the Usage/Cost APIs. Generate an Admin key at
**platform.openai.com → Settings → Organization → Admin Keys**. This key has broad org-level access —
treat it like a credential, not a regular API key.

### Anthropic — needs an Admin API key or an `org:admin` OAuth token

A normal workspace key (`sk-ant-api03-...`) will not authenticate against the Usage/Cost/Rate-Limits
APIs. Generate an Admin key (`sk-ant-admin01-...`) at **console.anthropic.com → Settings → Admin API
Keys**, or use an OAuth token scoped to `org:admin`.

### Gemini — a normal API key is fine

There is no admin tier to reach for on Gemini — a standard AI Studio API key is used only for a
connection test and to list models. It is never polled for usage, because no aggregate usage/cost/
quota endpoint exists for it (see `CLAUDE.md`).

All keys are AES-256-GCM encrypted before they're written to the database and are never returned to
the browser in full — only a masked preview (`sk-ant••••••••1234`).

## Cron / scheduler setup

Next.js has no built-in scheduler, so an external trigger calls the poll endpoint:

```
POST /api/cron/poll-usage
Header: x-cron-secret: <CRON_SECRET>
```

**Vercel Cron** (`vercel.json`, if deploying there):

```json
{
  "crons": [{ "path": "/api/cron/poll-usage", "schedule": "0 * * * *" }]
}
```

Vercel Cron doesn't let you set custom headers, so front the call with a tiny route that reads
`CRON_SECRET` from the environment and forwards it, or use a scheduler that does support custom
headers (Supabase's `pg_cron` + `pg_net`, GitHub Actions, cron-job.org, etc.):

```sql
-- Supabase pg_cron + pg_net example (run in the SQL editor)
select cron.schedule(
  'poll-usage-hourly',
  '0 * * * *',
  $$
  select net.http_post(
    url := 'https://<your-domain>/api/cron/poll-usage',
    headers := jsonb_build_object('x-cron-secret', '<CRON_SECRET>')
  );
  $$
);
```

Hourly is a reasonable default. Anthropic's data lands ~5 minutes after a request completes and can
be polled as often as once a minute if you want tighter freshness; OpenAI has no documented minimum
interval but hourly is plenty for a dashboard. Each poll also evaluates alert thresholds — see below.

## Slack alerts

Alerts fire on the dashboard automatically. To also post to Slack, create an **Incoming Webhook**:
Slack API → your app → Incoming Webhooks → Add New Webhook to Workspace → pick a channel. Set the
resulting URL (`https://hooks.slack.com/services/...`) as `SLACK_WEBHOOK_URL`. If it's unset, alerts
still appear on the Settings page — the cron job never fails over a missing webhook.

Thresholds are fixed at 50/75/90/100% of whatever "remaining" figure is genuinely known for a
provider (an admin-configured limit on the Limits page, or a provider-reported balance for a future
provider like DeepSeek). Each threshold fires Slack once per period — see `CLAUDE.md` § Alerts for
the de-duplication mechanism.

## Local dev

```bash
npm run dev         # start the dev server
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm run test          # vitest
npm run seed          # seed the three v1 providers
```

## Deployment

Any Next.js host works (Vercel, self-hosted with `next start`, etc.) — there's no dependency on
Vercel-specific APIs beyond the optional Vercel Cron config above. Set the same environment variables
in your host's dashboard, run the two SQL migrations against your Supabase project, and point your
scheduler at `/api/cron/poll-usage`.

## What this dashboard is honest about not knowing

- **Gemini** has no aggregate usage, cost, or quota API for a standard API key — usage/cost/rate-limit
  panels read "Not available from provider," not an estimate.
- **OpenAI** has no balance/remaining-credit endpoint, and no way to query rate limits outside of a
  live call's response headers — both read "Not available."
- **Anthropic** has no balance endpoint beyond its *configured* rate limits (not a live remaining
  count).

See `CLAUDE.md` for the full breakdown and how to extend this to Tavily, xAI, DeepSeek, and Mistral.
