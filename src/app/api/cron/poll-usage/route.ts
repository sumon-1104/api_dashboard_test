import { NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { pollProvider } from "@/lib/usage/poll";
import { evaluateAlerts } from "@/lib/usage/evaluate-alerts";

// Providers this app can actually poll. Gemini and Perplexity are
// intentionally excluded — neither has an aggregate usage/cost API to poll
// (see lib/providers/gemini.ts, perplexity.ts); DeepSeek is excluded for the
// same reason (balance-only, no usage-by-model endpoint). Tavily qualifies
// despite being credit- not token-shaped — it has a real GET /usage endpoint.
const POLLABLE_PROVIDER_SLUGS = ["openai", "anthropic", "tavily"];

// Vercel Hobby's default function limit is 10s; a system-wide poll of several
// providers can exceed that.
export const maxDuration = 60;

export async function POST(request: Request) {
  const unauthorized = requireCronSecret(request);
  if (unauthorized) return unauthorized;

  const admin = createAdminClient();

  // Polls every project's pollable provider row, system-wide — not scoped to
  // any one user, since this runs with the service-role client and bypasses
  // per-project RLS entirely.
  const { data: rows } = await admin
    .from("providers")
    .select("id, slug")
    .in("slug", POLLABLE_PROVIDER_SLUGS)
    .eq("enabled", true);

  // allSettled, not all: one project's provider throwing must not abort every
  // other project's poll in the same system-wide run.
  const settled = await Promise.allSettled((rows ?? []).map((p) => pollProvider(admin, p.id, p.slug)));
  const polled = settled.map((result, i) =>
    result.status === "fulfilled"
      ? result.value
      : {
          slug: rows![i].slug,
          polled: false,
          modelsSeen: 0,
          totalCostUsd: null,
          message: result.reason instanceof Error ? result.reason.message : "Poll failed",
        }
  );
  const alerts = await evaluateAlerts(admin);

  return NextResponse.json({ polled, alerts, ranAt: new Date().toISOString() });
}
