import { afterEach, describe, expect, it, vi } from "vitest";
import { GeminiProvider } from "./gemini";

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

describe("GeminiProvider.testConnection", () => {
  it("builds a usageSample from the ping's real usageMetadata", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(200, {
          usageMetadata: {
            promptTokenCount: 12,
            candidatesTokenCount: 1,
            cachedContentTokenCount: 3,
            thoughtsTokenCount: 2,
            totalTokenCount: 18,
          },
        })
      )
    );

    const result = await new GeminiProvider("AIza-test").testConnection();

    expect(result.ok).toBe(true);
    expect(result.usageSample).toEqual({
      modelName: "gemini-flash-latest",
      inputTokens: 12,
      outputTokens: 1,
      cachedTokens: 3,
      reasoningTokens: 2,
      totalTokens: 18,
      requestCount: 1,
    });
  });

  it("defaults missing usageMetadata fields to 0 rather than leaving them undefined", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { usageMetadata: {} })));

    const result = await new GeminiProvider("AIza-test").testConnection();

    expect(result.usageSample).toEqual({
      modelName: "gemini-flash-latest",
      inputTokens: 0,
      outputTokens: 0,
      cachedTokens: 0,
      reasoningTokens: 0,
      totalTokens: 0,
      requestCount: 1,
    });
  });

  it("reports an invalid-key message on 401/403 without a usageSample", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(403, { error: { message: "denied" } })));

    const result = await new GeminiProvider("bad-key").testConnection();

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/lacks Gemini API access/);
    expect(result.usageSample).toBeUndefined();
  });

  it("surfaces the provider's real error message on transient failures (e.g. 503 overload)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(503, { error: { message: "model overloaded", status: "UNAVAILABLE" } }))
    );

    const result = await new GeminiProvider("AIza-test").testConnection();

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/overloaded|UNAVAILABLE/);
  });
});

describe("GeminiProvider — endpoints with no aggregate API", () => {
  it("getUsage/getCost/getRateLimits/getBalance always return null — never synthesized", async () => {
    const provider = new GeminiProvider("k");
    expect(await provider.getUsage()).toBeNull();
    expect(await provider.getCost()).toBeNull();
    expect(await provider.getBalance()).toBeNull();
    expect(await provider.getRateLimits()).toBeNull();
  });
});

describe("GeminiProvider.getModels", () => {
  it("strips the 'models/' prefix Gemini's API returns", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(200, {
          models: [{ name: "models/gemini-flash-latest", displayName: "Gemini Flash Latest" }],
        })
      )
    );

    const models = await new GeminiProvider("k").getModels();

    expect(models).toEqual([{ modelName: "gemini-flash-latest", displayName: "Gemini Flash Latest" }]);
  });
});
