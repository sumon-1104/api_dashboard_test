import { afterEach, describe, expect, it } from "vitest";
import { getAlertThresholds, newlyCrossedThresholds, periodKeyFor } from "./alerts";

afterEach(() => {
  delete process.env.ALERT_THRESHOLD_PCTS;
});

describe("getAlertThresholds", () => {
  it("defaults to the 4-tier escalation when unset", () => {
    expect(getAlertThresholds()).toEqual([50, 75, 90, 100]);
  });

  it("parses a single configured threshold", () => {
    process.env.ALERT_THRESHOLD_PCTS = "80";
    expect(getAlertThresholds()).toEqual([80]);
  });

  it("parses, dedupes, and sorts a comma-separated list", () => {
    process.env.ALERT_THRESHOLD_PCTS = "90, 50, 50, 75";
    expect(getAlertThresholds()).toEqual([50, 75, 90]);
  });

  it("falls back to the default on unparseable input", () => {
    process.env.ALERT_THRESHOLD_PCTS = "not-a-number";
    expect(getAlertThresholds()).toEqual([50, 75, 90, 100]);
  });

  it("ignores out-of-range values but keeps valid ones from the same list", () => {
    process.env.ALERT_THRESHOLD_PCTS = "0,150,80,-10";
    expect(getAlertThresholds()).toEqual([80]);
  });
});

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
