import { afterEach, describe, expect, it, vi } from "vitest";
import { PerplexityProvider } from "./perplexity";

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

describe("PerplexityProvider.testConnection", () => {
  it("captures the ping's real usage and cost as a self-logged sample", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(200, {
          usage: { input_tokens: 5, output_tokens: 10, total_tokens: 15, input_tokens_details: { cache_read_input_tokens: 0 } },
          cost: { currency: "USD", total_cost: 0.0025 },
        })
      )
    );

    const result = await new PerplexityProvider("pplx-test").testConnection();

    expect(result.ok).toBe(true);
    expect(result.message).toMatch(/\$0\.002500 USD/);
    expect(result.usageSample).toEqual({
      modelName: "sonar",
      inputTokens: 5,
      outputTokens: 10,
      cachedTokens: 0,
      reasoningTokens: 0,
      totalTokens: 15,
      requestCount: 1,
    });
    expect(result.costUsdSample).toBe(0.0025);
  });

  it("flags an invalid key on 401 without a usageSample", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(401, { error: "invalid" })));

    const result = await new PerplexityProvider("bad").testConnection();

    expect(result.ok).toBe(false);
    expect(result.usageSample).toBeUndefined();
    expect(result.costUsdSample).toBeUndefined();
  });
});

describe("PerplexityProvider — no aggregate usage/cost API", () => {
  it("getUsage/getCost/getRateLimits/getBalance always return null — never synthesized", async () => {
    const provider = new PerplexityProvider("k");
    expect(await provider.getUsage()).toBeNull();
    expect(await provider.getCost()).toBeNull();
    expect(await provider.getBalance()).toBeNull();
    expect(await provider.getRateLimits()).toBeNull();
  });
});

describe("PerplexityProvider.getModels", () => {
  it("maps the OpenAI-compatible models list", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { object: "list", data: [{ id: "sonar" }] })));

    const models = await new PerplexityProvider("k").getModels();

    expect(models).toEqual([{ modelName: "sonar", displayName: "sonar" }]);
  });
});
