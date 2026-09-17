import { NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { pollProvider } from "@/lib/usage/poll";
import { evaluateAlerts } from "@/lib/usage/evaluate-alerts";

// Providers this app can actually poll. Gemini is intentionally excluded —
// it has no aggregate usage/cost API to poll (see lib/providers/gemini.ts).
const POLLABLE_PROVIDER_SLUGS = ["openai", "anthropic"];

export async function POST(request: Request) {
  const unauthorized = requireCronSecret(request);
  if (unauthorized) return unauthorized;

  const admin = createAdminClient();

  const polled = await Promise.all(POLLABLE_PROVIDER_SLUGS.map((slug) => pollProvider(admin, slug)));
  const alerts = await evaluateAlerts(admin);

  return NextResponse.json({ polled, alerts, ranAt: new Date().toISOString() });
}
