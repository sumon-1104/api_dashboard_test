// Remaining-usage tri-state, used everywhere "Remaining" is shown so the UI
// never presents an application-calculated number as an official provider
// quota. See CLAUDE.md "Remaining usage — three states".

// Visual-only cue on the Limits/Overview pages ("Warning Threshold e.g. 80%").
// Distinct from the fixed 50/75/90/100% Slack alert thresholds in lib/usage/alerts.ts.
export const WARNING_THRESHOLD_PCT = 80;

export type RemainingSource = "provider" | "application_calculated" | "unknown";

export interface RemainingQuota {
  source: RemainingSource;
  limit: number | null;
  used: number | null;
  remaining: number | null;
  percentUsed: number | null;
}

export function providerReportedRemaining(limit: number, used: number): RemainingQuota {
  return {
    source: "provider",
    limit,
    used,
    remaining: limit - used,
    percentUsed: limit > 0 ? (used / limit) * 100 : null,
  };
}

export function applicationCalculatedRemaining(limitValue: number, usedValue: number): RemainingQuota {
  return {
    source: "application_calculated",
    limit: limitValue,
    used: usedValue,
    remaining: limitValue - usedValue,
    percentUsed: limitValue > 0 ? (usedValue / limitValue) * 100 : null,
  };
}

export function unknownRemaining(): RemainingQuota {
  return { source: "unknown", limit: null, used: null, remaining: null, percentUsed: null };
}
