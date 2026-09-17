import { describe, expect, it } from "vitest";
import { newlyCrossedThresholds, periodKeyFor } from "./alerts";

describe("newlyCrossedThresholds", () => {
  it("fires every threshold at or below current usage on a fresh period", () => {
    expect(newlyCrossedThresholds(92, new Set())).toEqual([50, 75, 90]);
  });

  it("does not re-fire a threshold that already fired this period", () => {
    expect(newlyCrossedThresholds(92, new Set([50, 75, 90]))).toEqual([]);
  });

  it("fires only the newly-crossed threshold on the next run within the same period", () => {
    // usage climbed from 92% to 100% since the last run; 50/75/90 already fired
    expect(newlyCrossedThresholds(100, new Set([50, 75, 90]))).toEqual([100]);
  });

  it("fires nothing below the first threshold", () => {
    expect(newlyCrossedThresholds(40, new Set())).toEqual([]);
  });
});

describe("periodKeyFor", () => {
  it("formats a monthly period as YYYY-MM", () => {
    expect(periodKeyFor("monthly", new Date("2026-09-16T12:00:00Z"))).toBe("2026-09");
  });

  it("formats a daily period as YYYY-MM-DD", () => {
    expect(periodKeyFor("daily", new Date("2026-09-16T12:00:00Z"))).toBe("2026-09-16");
  });

  it("a new period key means a previously-fired threshold can fire again", () => {
    const septKey = periodKeyFor("monthly", new Date("2026-09-30T23:00:00Z"));
    const octKey = periodKeyFor("monthly", new Date("2026-10-01T01:00:00Z"));
    expect(septKey).not.toBe(octKey);
    // A dedup set keyed by (provider, limit_type, threshold, period_key) means
    // alreadyFired from September never applies to October's key.
    expect(newlyCrossedThresholds(90, new Set())).toEqual([50, 75, 90]);
  });
});
