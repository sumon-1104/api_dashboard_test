import { afterEach, describe, expect, it, vi } from "vitest";
import { TavilyProvider } from "./tavily";

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  } as Response;
}

const SAMPLE_USAGE = {
  key: { usage: 320, limit: 1000, search_usage: 300, extract_usage: 10, crawl_usage: 5, map_usage: 3, research_usage: 2 },
  account: { current_plan: "Pro" },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("TavilyProvider.testConnection", () => {
  it("reports the real plan and cycle usage from /usage", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, SAMPLE_USAGE)));

    const result = await new TavilyProvider("tvly-test").testConnection();

    expect(result.ok).toBe(true);
    expect(result.message).toMatch(/Pro/);
    expect(result.message).toMatch(/320\/1,000 credits/);
  });

  it("shows 'unlimited' when the key has no plan limit", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(200, { ...SAMPLE_USAGE, key: { ...SAMPLE_USAGE.key, limit: null } }))
    );

    const result = await new TavilyProvider("tvly-test").testConnection();

    expect(result.message).toMatch(/unlimited/);
  });

  it("flags an invalid key on 401", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(401, { error: "invalid" })));

    const result = await new TavilyProvider("bad").testConnection();

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/invalid/);
  });
});

describe("TavilyProvider.getUsage", () => {
  it("splits the key's per-endpoint credits into creditBuckets with no fabricated requestCount", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, SAMPLE_USAGE)));

    const usage = await new TavilyProvider("tvly-test").getUsage();

    expect(usage?.kind).toBe("search");
    expect(usage?.creditBuckets).toEqual([
      { endpoint: "search", creditsUsed: 300, requestCount: null },
      { endpoint: "extract", creditsUsed: 10, requestCount: null },
      { endpoint: "crawl", creditsUsed: 5, requestCount: null },
      { endpoint: "map", creditsUsed: 3, requestCount: null },
      { endpoint: "research", creditsUsed: 2, requestCount: null },
    ]);
  });
});

describe("TavilyProvider.getRateLimits", () => {
  it("maps the key's plan usage/limit to a provider_reported rate limit entry", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, SAMPLE_USAGE)));

    const limits = await new TavilyProvider("tvly-test").getRateLimits();

    expect(limits).toEqual([
      { limitType: "plan_credits", currentUsage: 320, limitValue: 1000, resetAt: null, source: "provider_reported" },
    ]);
  });
});

describe("TavilyProvider — no cost/balance/model data", () => {
  it("getCost/getBalance/getModels always return null — never converted from credits", async () => {
    const provider = new TavilyProvider("k");
    expect(await provider.getCost()).toBeNull();
    expect(await provider.getBalance()).toBeNull();
    expect(await provider.getModels()).toBeNull();
  });
});
