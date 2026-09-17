import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, LimitPeriod, LimitType } from "@/types/database";
import { newlyCrossedThresholds, periodKeyFor, formatAlertMessage } from "./alerts";
import { sendSlackAlert } from "@/lib/notifications/slack";

type AdminClient = SupabaseClient<Database>;

function periodRange(period: LimitPeriod, at: Date): { start: Date; end: Date } {
  if (period === "monthly") {
    const start = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1));
    const end = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth() + 1, 1));
    return { start, end };
  }
  const start = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

async function usedValueForLimit(
  admin: AdminClient,
  providerId: string,
  limitType: LimitType,
  period: LimitPeriod,
  now: Date
): Promise<number> {
  const { start, end } = periodRange(period, now);
  const { data } = await admin
    .from("usage_records")
    .select("total_tokens, estimated_cost, metadata")
    .eq("provider_id", providerId)
    .gte("created_at", start.toISOString())
    .lt("created_at", end.toISOString());

  if (!data) return 0;

  switch (limitType) {
    case "monthly_tokens":
    case "daily_tokens":
      return data.reduce((sum, r) => sum + Number(r.total_tokens ?? 0), 0);
    case "monthly_spend":
      return data.reduce((sum, r) => sum + Number(r.estimated_cost ?? 0), 0);
    case "requests":
      return data.reduce((sum, r) => {
        const metadata = r.metadata as { requestCount?: number } | null;
        return sum + Number(metadata?.requestCount ?? 0);
      }, 0);
    default:
      return 0;
  }
}

export interface FiredAlert {
  providerId: string;
  providerName: string;
  thresholdPct: number;
  percentUsed: number;
  delivered: boolean;
}

/**
 * Evaluates every admin-configured usage_limits row against real tracked
 * usage, and fires (dashboard + Slack) alerts for thresholds crossed since
 * the last run. The unique constraint on `alerts` is the source of truth for
 * de-duplication — the upsert below relies on it, not just the in-memory set.
 */
export async function evaluateAlerts(admin: AdminClient): Promise<FiredAlert[]> {
  const now = new Date();
  const [{ data: limits }, { data: providers }] = await Promise.all([
    admin.from("usage_limits").select("*"),
    admin.from("providers").select("id, name"),
  ]);

  const providerNameById = new Map((providers ?? []).map((p) => [p.id, p.name]));
  const fired: FiredAlert[] = [];

  for (const limit of limits ?? []) {
    const used = await usedValueForLimit(admin, limit.provider_id, limit.limit_type, limit.period, now);
    const percentUsed = limit.limit_value > 0 ? (used / limit.limit_value) * 100 : 0;
    const periodKey = periodKeyFor(limit.period, now);

    const { data: existingAlerts } = await admin
      .from("alerts")
      .select("threshold_pct")
      .eq("provider_id", limit.provider_id)
      .eq("limit_type", "usage_limit")
      .eq("period_key", periodKey);

    const alreadyFired = new Set((existingAlerts ?? []).map((a) => a.threshold_pct));
    const toFire = newlyCrossedThresholds(percentUsed, alreadyFired);

    for (const thresholdPct of toFire) {
      const { data: inserted } = await admin
        .from("alerts")
        .upsert(
          {
            provider_id: limit.provider_id,
            limit_type: "usage_limit",
            threshold_pct: thresholdPct,
            period_key: periodKey,
            channel: "slack",
            delivered: false,
          },
          { onConflict: "provider_id,limit_type,threshold_pct,period_key", ignoreDuplicates: true }
        )
        .select("id");

      // Empty result means another run already inserted this exact row —
      // the unique constraint caught a race; skip sending Slack again.
      if (!inserted || inserted.length === 0) continue;

      const providerName = providerNameById.get(limit.provider_id) ?? "Provider";
      const message = formatAlertMessage({ providerName, thresholdPct, percentUsed, limitType: "usage_limit" });
      const delivered = await sendSlackAlert(message);
      await admin.from("alerts").update({ delivered }).eq("id", inserted[0].id);

      fired.push({ providerId: limit.provider_id, providerName, thresholdPct, percentUsed, delivered });
    }
  }

  return fired;
}
