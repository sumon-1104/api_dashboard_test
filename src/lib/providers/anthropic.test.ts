import { afterEach, describe, expect, it, vi } from "vitest";
import { AnthropicProvider } from "./anthropic";

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

describe("AnthropicProvider.testConnection", () => {
  it("succeeds when the admin key can read rate_limits", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { data: [], next_page: null })));
    const result = await new AnthropicProvider("sk-ant-admin01-test").testConnection();
    expect(result).toEqual({ ok: true, message: "Connected using Admin API key." });
  });

  it("reports missing org:admin scope on 403", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(403, { error: { message: "forbidden" } })));
    const result = await new AnthropicProvider("sk-ant-api03-regular").testConnection();
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/org:admin scope/);
  });
});

describe("AnthropicProvider.getUsage", () => {
  it("sums cache_read + both cache_creation windows into cachedTokens, per Anthropic's usage_report shape", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(200, {
          data: [
            {
              starting_at: "2026-09-01T00:00:00Z",
              ending_at: "2026-09-02T00:00:00Z",
              results: [
                {
                  model: "claude-haiku-4-5",
                  uncached_input_tokens: 100,
                  cache_read_input_tokens: 30,
                  cache_creation: { ephemeral_1h_input_tokens: 5, ephemeral_5m_input_tokens: 15 },
                  output_tokens: 40,
                },
              ],
            },
          ],
          has_more: false,
          next_page: null,
        })
      )
    );

    const usage = await new AnthropicProvider("sk-ant-admin01-test").getUsage({
      start: new Date("2026-09-01T00:00:00Z"),
      end: new Date("2026-09-02T00:00:00Z"),
    });

    // cachedTokens = cache_read (30) + ephemeral_1h (5) + ephemeral_5m (15) = 50
    // totalTokens = uncached_input (100) + output (40) + cached (50) = 190
    expect(usage?.tokenBuckets).toEqual([
      {
        modelName: "claude-haiku-4-5",
        inputTokens: 100,
        outputTokens: 40,
        cachedTokens: 50,
        reasoningTokens: 0,
        totalTokens: 190,
        requestCount: null,
      },
    ]);
  });

  it("aligns a same-day, mid-day range to UTC day boundaries — the poller's real usage pattern", async () => {
    // The poller always calls getUsage({start: startOfUtcDay(now), end: now}) —
    // a non-midnight `end` with bucket_width=1d is rejected by Anthropic with
    // "Invalid date range: ending date must be after starting date" once it
    // rounds internally. starting_at must stay floored, ending_at must be
    // pushed to the *next* midnight so the request spans a real bucket.
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { data: [], has_more: false, next_page: null }));
    vi.stubGlobal("fetch", fetchMock);

    await new AnthropicProvider("sk-ant-admin01-test").getUsage({
      start: new Date("2026-09-28T00:00:00.000Z"),
      end: new Date("2026-09-28T22:01:28.821Z"),
    });

    const calledUrl = new URL(fetchMock.mock.calls[0][0] as string);
    expect(calledUrl.searchParams.get("starting_at")).toBe("2026-09-28T00:00:00.000Z");
    expect(calledUrl.searchParams.get("ending_at")).toBe("2026-09-29T00:00:00.000Z");
  });

  it("does not widen an already day-aligned range by an extra day", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { data: [], has_more: false, next_page: null }));
    vi.stubGlobal("fetch", fetchMock);

    await new AnthropicProvider("sk-ant-admin01-test").getCost({
      start: new Date("2026-09-01T00:00:00.000Z"),
      end: new Date("2026-09-02T00:00:00.000Z"),
    });

    const calledUrl = new URL(fetchMock.mock.calls[0][0] as string);
    expect(calledUrl.searchParams.get("starting_at")).toBe("2026-09-01T00:00:00.000Z");
    expect(calledUrl.searchParams.get("ending_at")).toBe("2026-09-02T00:00:00.000Z");
  });

  it("follows pagination across multiple pages", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, {
          data: [
            {
              starting_at: "2026-09-01T00:00:00Z",
              ending_at: "2026-09-02T00:00:00Z",
              results: [
                {
                  model: "claude-haiku-4-5",
                  uncached_input_tokens: 10,
                  cache_read_input_tokens: 0,
                  cache_creation: { ephemeral_1h_input_tokens: 0, ephemeral_5m_input_tokens: 0 },
                  output_tokens: 5,
                },
              ],
            },
          ],
          has_more: true,
          next_page: "p2",
        })
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          data: [
            {
              starting_at: "2026-09-02T00:00:00Z",
              ending_at: "2026-09-03T00:00:00Z",
              results: [
                {
                  model: "claude-haiku-4-5",
                  uncached_input_tokens: 20,
                  cache_read_input_tokens: 0,
                  cache_creation: { ephemeral_1h_input_tokens: 0, ephemeral_5m_input_tokens: 0 },
                  output_tokens: 10,
                },
              ],
            },
          ],
          has_more: false,
          next_page: null,
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    const usage = await new AnthropicProvider("sk-ant-admin01-test").getUsage({
      start: new Date("2026-09-01T00:00:00Z"),
      end: new Date("2026-09-03T00:00:00Z"),
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(usage?.tokenBuckets?.[0]).toMatchObject({ inputTokens: 30, outputTokens: 15 });
  });
});

describe("AnthropicProvider.getCost", () => {
  it("divides summed cent amounts by 100 to get USD", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(200, {
          data: [
            {
              starting_at: "2026-09-01T00:00:00Z",
              ending_at: "2026-09-02T00:00:00Z",
              results: [
                { amount: "123", currency: "usd", description: "claude-haiku-4-5" },
                { amount: "77", currency: "usd", description: "claude-haiku-4-5" },
              ],
            },
          ],
          has_more: false,
          next_page: null,
        })
      )
    );

    const cost = await new AnthropicProvider("sk-ant-admin01-test").getCost({
      start: new Date("2026-09-01T00:00:00Z"),
      end: new Date("2026-09-02T00:00:00Z"),
    });

    // (123 + 77) cents = 200 cents = $2.00
    expect(cost?.totalCostUsd).toBe(2);
  });
});

describe("AnthropicProvider.getRateLimits", () => {
  it("maps configured limits, never a live remaining count", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(200, {
          data: [
            {
              group_type: "default",
              models: null,
              limits: [
                { type: "requests_per_minute", value: 1000 },
                { type: "tokens_per_minute", value: 100000 },
              ],
            },
          ],
          next_page: null,
        })
      )
    );

    const limits = await new AnthropicProvider("sk-ant-admin01-test").getRateLimits();

    expect(limits).toEqual([
      { limitType: "requests_per_minute", currentUsage: null, limitValue: 1000, resetAt: null, source: "provider_reported" },
      { limitType: "tokens_per_minute", currentUsage: null, limitValue: 100000, resetAt: null, source: "provider_reported" },
    ]);
  });
});

describe("AnthropicProvider.getBalance", () => {
  it("always returns null — no balance endpoint beyond configured rate limits", async () => {
    expect(await new AnthropicProvider("k").getBalance()).toBeNull();
  });
});
