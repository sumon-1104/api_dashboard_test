import { describe, expect, it } from "vitest";
import { calculateTokenCost, resolveCost } from "./index";

describe("calculateTokenCost", () => {
  it("computes input + output cost from per-million pricing", () => {
    const cost = calculateTokenCost({
      inputTokens: 1_000_000,
      outputTokens: 500_000,
      inputPricePerMillion: 3,
      outputPricePerMillion: 15,
    });
    expect(cost).toBeCloseTo(3 + 7.5, 6);
  });

  it("returns null (N/A) when input pricing is missing", () => {
    const cost = calculateTokenCost({
      inputTokens: 1000,
      outputTokens: 1000,
      inputPricePerMillion: null,
      outputPricePerMillion: 15,
    });
    expect(cost).toBeNull();
  });

  it("returns null (N/A) when output pricing is missing", () => {
    const cost = calculateTokenCost({
      inputTokens: 1000,
      outputTokens: 1000,
      inputPricePerMillion: 3,
      outputPricePerMillion: null,
    });
    expect(cost).toBeNull();
  });
});

describe("resolveCost", () => {
  it("prefers the provider-reported cost when present", () => {
    const result = resolveCost(12.34, 99);
    expect(result).toEqual({ costUsd: 12.34, source: "provider_reported" });
  });

  it("falls back to the calculated cost when the provider didn't report one", () => {
    const result = resolveCost(null, 4.5);
    expect(result).toEqual({ costUsd: 4.5, source: "application_calculated" });
  });

  it("is unavailable when neither is known", () => {
    const result = resolveCost(undefined, null);
    expect(result).toEqual({ costUsd: null, source: "unavailable" });
  });
});
