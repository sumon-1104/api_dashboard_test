# AI API Usage Dashboard — User Guide

A monitoring dashboard for your real OpenAI, Anthropic, Gemini, Tavily, DeepSeek, Perplexity,
and xAI usage, cost, and billing — built on one rule: **every number comes from the provider
itself.** Where a provider doesn't expose a figure, the dashboard says "Not available" instead
of estimating. Nothing is ever guessed.

For architecture and developer-facing details, see `CLAUDE.md`. For local setup and
environment configuration, see `README.md`. This guide covers day-to-day use.

## Contents

1. [Getting started](#1-getting-started)
2. [Projects](#2-projects)
3. [Providers](#3-providers)
4. [API keys](#4-api-keys)
5. [Overview dashboard](#5-overview-dashboard)
6. [Usage page](#6-usage-page)
7. [Models page](#7-models-page)
8. [Errors page](#8-errors-page)
9. [Polling and alerts](#9-polling-and-alerts)
10. [Settings](#10-settings)
11. [Provider capability reference](#11-provider-capability-reference)
12. [Provider key requirements at a glance](#12-provider-key-requirements-at-a-glance)
13. [Troubleshooting](#13-troubleshooting)

---

## 1. Getting started

The fastest path from a blank account to real data on screen:

1. **Sign in.** Go to `/login`. New here? Use the **Create account** tab; existing users just
   sign in. Every project and key you create afterward belongs to your account only —
   enforced at the database level, not just hidden in the UI.
2. **Create a project.** Open **Projects** → **Create project**. Give it a name that reflects
   what it's for (a client, an environment, a product) — you can create as many as you like.
3. **Add a provider.** On the project's page, pick one from the catalog under **Add provider**
   (or add a custom name for anything not listed).
4. **Add a key.** On the provider's card, click **Add key** and paste in a real API key. Some
   providers need a specific key *type*, not just any key — see
   [section 12](#12-provider-key-requirements-at-a-glance) before you get one.
5. **Test it.** Click **Test Connection**. This makes a real call to that provider — success or
   failure, the message you see is genuine, straight from the provider's own API.
6. **Check Overview.** Once at least one provider is connected, the **Overview** page starts
   showing real totals. Full historical charts, though, depend on the poller actually
   running — see [section 9](#9-polling-and-alerts) if numbers aren't updating on their own.

That's the whole loop. Everything below is reference for what each screen does and why.

## 2. Projects

A **Project** is the top-level container for a set of providers and their keys — the natural
way to separate clients, environments, or products so their spending and history never mix.
The same provider (e.g. OpenAI) can exist independently in multiple projects, each with its own
key and its own usage history.

- Create a project from the **Projects** page in the sidebar.
- Opening a project takes you to its dedicated page for adding providers and keys.
- Switching projects is just a click back to **Projects** and selecting another one.

## 3. Providers

A provider record connects one AI service to a project. You can choose from a built-in catalog
of 8 known providers, or add an arbitrary custom name for anything not listed.

| Status | Providers | What you get |
|---|---|---|
| **Fully supported** | OpenAI, Anthropic, Gemini, Tavily, DeepSeek, Perplexity, xAI | Live Test Connection, and real usage/cost/balance data pulled straight from that provider's own API |
| **Key storage only** | Mistral, and any custom name | The key is stored securely, but there's no live connection test or automatic polling yet — this is a deliberate, honest limitation, not a bug |

**To add one:** open a project, choose a provider under **Add provider**, optionally give it a
display name, and confirm.

**Renaming:** click **Edit name** on the provider's card — useful for distinguishing multiple
keys of the same provider (e.g. "OpenAI – Production" vs. "OpenAI – Staging").

**Removing:** click **Remove provider**. Read the confirmation carefully — unlike removing a
single key, removing a provider **permanently deletes every key, usage record, model, and error
log** collected under it. This cannot be undone.

## 4. API keys

Keys are encrypted (AES-256-GCM) the moment they're submitted and are never sent back to your
browser in full afterward — only a masked preview, e.g. `sk-ant••••••••1234`.

On a provider's card:

- **Add key** (or **Replace key**, if one already exists) — paste the key and save. Replacing a
  key overwrites the old one in place; it doesn't create a second, duplicate credential.
- **Test Connection** — makes a real call to the provider. You'll see either a genuine success
  message (sometimes including a live balance or usage snapshot) or the provider's own real
  error text — never a simulated result either way.
- **Remove** — deletes just the key. Historical usage data already collected stays intact; only
  removing the whole *provider* (section 3) deletes history.

Which key type each provider needs is summarized in [section 12](#12-provider-key-requirements-at-a-glance).

## 5. Overview dashboard

A single-glance, month-to-date summary across every connected provider: total requests, total
tokens, and estimated cost, broken down per provider.

- **Filters** at the top-right narrow the view: no selection shows totals across every project
  you own; selecting a project alone shows everything under it; selecting a project *and* a
  specific provider narrows to just that one.
- **Credit-based providers** (currently Tavily) show a "Credits used" figure instead of tokens
  and cost, since credits aren't priced per token the way OpenAI/Anthropic usage is.
- **Status badges** reflect both whether a provider is enabled *and* whether its last connection
  attempt succeeded — a disabled provider always shows **Disabled**, even if it tested
  successfully before being turned off. The badge and the "Active Providers" count never
  disagree.
- Figures here come from the last stored poll snapshot, not a live lookup made when you open the
  page — see [section 9](#9-polling-and-alerts) for what actually keeps that snapshot current.

## 6. Usage page

The same data as Overview, but charted over a date range you choose — useful for spotting
trends rather than just a month-to-date total. Filtering by project and provider works the same
way as Overview.

## 7. Models page

Cost calculations need a price per token for each model, and this app never assumes or
hard-codes one — providers change pricing, and different accounts may have different rates.

- A model discovered from real usage data appears here automatically, starting **unpriced**.
- Until you set a price, that model's contribution to cost shows as "Not available," never a
  guess.
- Set input/output price per million tokens once, and every future cost calculation for that
  model uses it.
- Disable a model to exclude it from cost totals without losing its usage history.

## 8. Errors page

A paginated log of every failed provider call — both a failed **Test Connection** and a failed
scheduled poll land here, with the provider's own real error message. Filter by project and
provider the same way as everywhere else. If something isn't connecting and you don't know why,
this page has the answer before you go looking at server logs.

## 9. Polling and alerts

This is the part that's easiest to misunderstand, so it's worth being precise:

`POST /api/cron/poll-usage` is a plain HTTP endpoint. **It does not run on a timer, and nothing
triggers it automatically when the app starts.** It only executes when something sends it a
request with the correct secret header. For recurring, automatic polling, you need an external
scheduler pointed at that URL — Vercel Cron, Supabase's `pg_cron` + `pg_net`, a GitHub Actions
scheduled workflow, or a plain cron service all work; see `README.md` for setup examples.
**Without one configured, usage data simply stays frozen at whatever the last poll captured** —
nothing will silently "just work" in the background on its own.

Only providers with a genuine aggregate usage/cost endpoint are polled this way — today that's
OpenAI, Anthropic, and Tavily. The others (Gemini, DeepSeek, Perplexity, xAI) either have no
such endpoint at all, or only report a live balance/self-logged figure at Test Connection time —
see [section 11](#11-provider-capability-reference) for exactly what each one supports.

Each successful poll also checks usage against configured thresholds (50/75/90/100% by default,
overridable via `ALERT_THRESHOLD_PCTS`). The first time a threshold is crossed in a given
period, you're notified; crossing it again in the same period doesn't re-notify, but a *higher*
threshold, or a new billing period, will.

## 10. Settings

Shows whether Slack alerting is configured (`SLACK_WEBHOOK_URL` set as an environment variable —
not something you configure from the UI) and a complete history of every alert that's fired,
with its provider, threshold, and delivery status. Alerts still appear here even without Slack
configured — nothing about the dashboard's core function depends on it.

## 11. Provider capability reference

| Provider | Test Connection | Usage history | Cost | Balance | Rate limits |
|---|---|---|---|---|---|
| OpenAI | Yes | Polled | Polled | Not exposed by provider | Not exposed outside live response headers |
| Anthropic | Yes | Polled | Polled | Not exposed by provider | Yes (configured limits) |
| Gemini | Yes | Self-logged (live ping only) | Not available | Not available | Not available |
| Tavily | Yes | Polled (credits, not tokens) | Not applicable (credits, not USD) | Not available | Yes (plan credit limit) |
| DeepSeek | Yes | Not available | Not available | Yes | Not available |
| Perplexity | Yes | Self-logged (live ping only) | Self-logged (real $ per ping) | Not available | Not available |
| xAI | Yes | Not available | Not available | Yes | Not available |
| Mistral | Not yet implemented | — | — | — | — |
| Custom | Not yet implemented | — | — | — | — |

Every gap above is a genuine limitation of that provider's own API — never something the
dashboard simply hasn't gotten around to showing.

## 12. Provider key requirements at a glance

| Provider | Key you need | Where to get it | Watch out for |
|---|---|---|---|
| **OpenAI** | Admin API key | platform.openai.com → Settings → Organization → Admin Keys | A standard `sk-proj-...` key cannot read usage data at all |
| **Anthropic** | Admin API key or `org:admin` OAuth token | platform.claude.com/settings/admin-keys | Requires an **Organization** account with the **admin** role — a personal account will never show this option |
| **Gemini** | Standard API key | aistudio.google.com/api-keys | Test Connection makes one real, tiny live call; occasional `503 UNAVAILABLE` is normal provider congestion, not a broken key |
| **Tavily** | Standard API key | app.tavily.com/home | Free tier, 1,000 credits/month, no card required |
| **DeepSeek** | Standard API key | platform.deepseek.com/api_keys | Requires a funded account balance before the key will authorize any call |
| **Perplexity** | Standard API key | console.perplexity.ai | Requires a payment method on file before you can even generate a key |
| **xAI** | Management key **and** Team ID | console.x.ai → Settings → Management Keys, plus console.x.ai/team/default/settings/team | Both fields are required together — a Management key alone will fail |

## 13. Troubleshooting

**"Active Providers" count doesn't match the number of green "Connected" badges I see.**
The status badge reflects both whether a provider is *enabled* and its *last test result*. A
provider that was successfully tested and later disabled will always show **Disabled**, not
a stale "Connected." If you still see a mismatch, check whether a provider was recently toggled
off on its project page.

**Gemini's Test Connection fails with a `503` error mentioning "high demand."**
Not a bug, and not a sign of a bad key — a bad key fails with `401`/`403` instead. A `503` means
Google's servers are temporarily overloaded for that model. Wait a minute and try again.

**I can't find "Admin keys" in the Anthropic console at all.**
It's not hidden in a different menu — Admin API keys only exist for **Organization** accounts,
and only for members with the **admin** role. An individual account will never show this option.
Ask whoever manages your Anthropic organization to grant you the admin role, or to create the
key and share it with you. (Also note: `console.anthropic.com` now redirects to
`platform.claude.com` — same product, new address.)

**Numbers on Overview/Usage aren't updating even though I know I've used the API.**
Nothing polls automatically without an external scheduler configured — see
[section 9](#9-polling-and-alerts). Confirm a scheduler is actually calling
`/api/cron/poll-usage`, or trigger it manually to confirm the pipeline itself works.

**I removed a key by mistake but the provider's history looks gone too.**
Removing a single *key* keeps historical usage data. Removing the whole *provider* deletes
everything under it, including history — check which action you actually took; the
confirmation dialog is explicit about which one you're doing.

**Test Connection succeeds, but I don't see anything under Errors.**
That's expected — the Errors page only logs *failed* attempts. A success writes to Overview/
Usage's usage history instead (where applicable).
