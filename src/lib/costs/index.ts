// Centralized cost math. Pricing always comes from the `models` table — never
// hard-code a price here or in a component.

export interface TokenCostInput {
  inputTokens: number;
  outputTokens: number;
  inputPricePerMillion: number | null;
  outputPricePerMillion: number | null;
}

/** Returns null ("N/A") when either price is unknown — never guesses a price. */
export function calculateTokenCost({
  inputTokens,
  outputTokens,
  inputPricePerMillion,
  outputPricePerMillion,
}: TokenCostInput): number | null {
  if (inputPricePerMillion == null || outputPricePerMillion == null) {
    return null;
  }
  const inputCost = (inputTokens / 1_000_000) * inputPricePerMillion;
  const outputCost = (outputTokens / 1_000_000) * outputPricePerMillion;
  return inputCost + outputCost;
}

export type CostSource = "provider_reported" | "application_calculated" | "unavailable";

export interface ResolvedCost {
  costUsd: number | null;
  source: CostSource;
}

/**
 * Prefer the provider's own reported cost (Cost API) when present; fall back
 * to the calculated figure only when the provider didn't report one. Always
 * carries which source produced the number so the UI can label it honestly.
 */
export function resolveCost(
  providerReportedCostUsd: number | null | undefined,
  calculatedCostUsd: number | null
): ResolvedCost {
  if (providerReportedCostUsd != null) {
    return { costUsd: providerReportedCostUsd, source: "provider_reported" };
  }
  if (calculatedCostUsd != null) {
    return { costUsd: calculatedCostUsd, source: "application_calculated" };
  }
  return { costUsd: null, source: "unavailable" };
}

export function formatUsd(amount: number | null): string {
  if (amount == null) return "N/A";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 4 }).format(
    amount
  );
}
