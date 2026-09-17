import { describe, expect, it } from "vitest";
import { applicationCalculatedRemaining, providerReportedRemaining, unknownRemaining } from "./remaining";

describe("remaining-quota tri-state", () => {
  it("provider-reported: computes remaining and percentUsed, tags source as provider", () => {
    const quota = providerReportedRemaining(1000, 250);
    expect(quota).toEqual({ source: "provider", limit: 1000, used: 250, remaining: 750, percentUsed: 25 });
  });

  it("application-calculated: same math, different source tag", () => {
    const quota = applicationCalculatedRemaining(5_000_000, 4_500_000);
    expect(quota.source).toBe("application_calculated");
    expect(quota.remaining).toBe(500_000);
    expect(quota.percentUsed).toBe(90);
  });

  it("unknown: every numeric field is null, source is unknown", () => {
    const quota = unknownRemaining();
    expect(quota).toEqual({ source: "unknown", limit: null, used: null, remaining: null, percentUsed: null });
  });

  it("never mixes sources — an unknown quota carries no application-calculated numbers", () => {
    const quota = unknownRemaining();
    expect(quota.limit).toBeNull();
    expect(quota.used).toBeNull();
  });
});
