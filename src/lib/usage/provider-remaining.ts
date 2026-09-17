import type { UsageLimit } from "@/types/database";
import { applicationCalculatedRemaining, unknownRemaining, type RemainingQuota } from "./remaining";

/**
 * Picks the provider's monthly token limit (if configured) and turns it into
 * an application-calculated remaining figure. No provider in v1 exposes a
 * genuine "remaining tokens" endpoint, so this can never be "provider"-sourced.
 */
export function tokenRemainingForProvider(limits: UsageLimit[], providerId: string, usedTokens: number): RemainingQuota {
  const limit = limits.find((l) => l.provider_id === providerId && l.limit_type === "monthly_tokens");
  if (!limit) return unknownRemaining();
  return applicationCalculatedRemaining(limit.limit_value, usedTokens);
}

export function spendRemainingForProvider(limits: UsageLimit[], providerId: string, usedSpend: number): RemainingQuota {
  const limit = limits.find((l) => l.provider_id === providerId && l.limit_type === "monthly_spend");
  if (!limit) return unknownRemaining();
  return applicationCalculatedRemaining(limit.limit_value, usedSpend);
}
