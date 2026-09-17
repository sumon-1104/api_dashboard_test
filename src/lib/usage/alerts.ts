// Pure threshold-crossing logic for the alert engine. Kept dependency-free
// (no Supabase client) so it's directly unit-testable; the cron route wires
// this to the `alerts` table for de-duplication.

export const ALERT_THRESHOLDS = [50, 75, 90, 100] as const;

export type AlertPeriod = "daily" | "monthly";

/** '2026-09' for monthly, '2026-09-16' for daily — matches alerts.period_key. */
export function periodKeyFor(period: AlertPeriod, at: Date = new Date()): string {
  const y = at.getUTCFullYear();
  const m = String(at.getUTCMonth() + 1).padStart(2, "0");
  if (period === "monthly") return `${y}-${m}`;
  const d = String(at.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Only evaluate where a real remaining figure exists — the caller must not
 * invoke this for an "unknown" remaining quota.
 */
export function newlyCrossedThresholds(percentUsed: number, alreadyFired: ReadonlySet<number>): number[] {
  return ALERT_THRESHOLDS.filter((t) => percentUsed >= t && !alreadyFired.has(t));
}

export function formatAlertMessage(params: {
  providerName: string;
  thresholdPct: number;
  percentUsed: number;
  limitType: "usage_limit" | "balance";
}): string {
  const { providerName, thresholdPct, percentUsed, limitType } = params;
  const remainingPct = Math.max(0, 100 - percentUsed);
  const icon = thresholdPct >= 100 ? "🔴" : thresholdPct >= 90 ? "🟠" : "🟡";
  const subject = limitType === "balance" ? "balance" : "usage limit";
  return `${icon} ${providerName} ${subject} is at ${percentUsed.toFixed(1)}% used (${remainingPct.toFixed(
    1
  )}% remaining) — crossed the ${thresholdPct}% threshold.`;
}
