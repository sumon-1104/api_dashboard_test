import { afterEach, describe, expect, it, vi } from "vitest";
import { XaiProvider } from "./xai";

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  } as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("XaiProvider — missing team_id", () => {
  it("fails testConnection with a clear message instead of guessing a team", async () => {
    const result = await new XaiProvider("mgmt-key", null).testConnection();

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/Team ID/);
  });

  it("returns null from getBalance rather than fabricating one", async () => {
    expect(await new XaiProvider("mgmt-key", null).getBalance()).toBeNull();
  });
});

describe("XaiProvider.testConnection", () => {
  it("reports the real prepaid balance when a team_id is present", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { balance: "500.00", currency: "USD" })));

    const result = await new XaiProvider("mgmt-key", "team-123").testConnection();

    expect(result.ok).toBe(true);
    expect(result.message).toMatch(/500\.00 USD/);
  });

  it("flags an invalid management key on 401", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(401, { error: "invalid" })));

    const result = await new XaiProvider("bad", "team-123").testConnection();

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/Management key is invalid/);
  });
});

describe("XaiProvider.getBalance", () => {
  it("parses the real balance as a number", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { balance: "500.00", currency: "USD" })));

    expect(await new XaiProvider("mgmt-key", "team-123").getBalance()).toEqual({ amount: 500, currency: "USD" });
  });
});

describe("XaiProvider — no documented usage-by-model API", () => {
  it("getUsage/getCost/getRateLimits/getModels always return null", async () => {
    const provider = new XaiProvider("mgmt-key", "team-123");
    expect(await provider.getUsage()).toBeNull();
    expect(await provider.getCost()).toBeNull();
    expect(await provider.getRateLimits()).toBeNull();
    expect(await provider.getModels()).toBeNull();
  });
});
