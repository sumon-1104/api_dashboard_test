import { afterEach, describe, expect, it, vi } from "vitest";
import { OpenAIProvider } from "./openai";

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

describe("OpenAIProvider.testConnection", () => {
  it("succeeds when the admin key can read the usage endpoint", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(200, { object: "page", data: [], has_more: false, next_page: null }))
    );
    const result = await new OpenAIProvider("sk-admin-test").testConnection();
    expect(result).toEqual({ ok: true, message: "Connected using Admin API key." });
  });

  it("reports a clear message on 401 rather than a raw HTTP error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(401, { error: { message: "invalid api key" } }))
    );
    const result = await new OpenAIProvider("sk-bad").testConnection();
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/Admin API key is invalid/);
  });
});

describe("OpenAIProvider.getUsage", () => {
  it("aggregates input/output/cached tokens per model within one page", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(200, {
          object: "page",
          data: [
            {
              object: "bucket",
              start_time: 0,
              end_time: 86400,
              results: [
                { input_tokens: 100, output_tokens: 20, input_cached_tokens: 10, num_model_requests: 2, model: "gpt-4o-mini" },
                { input_tokens: 5, output_tokens: 1, input_cached_tokens: 0, num_model_requests: 1, model: "gpt-4o-mini" },
              ],
            },
          ],
          has_more: false,
          next_page: null,
        })
      )
    );

    const usage = await new OpenAIProvider("sk-admin-test").getUsage({
      start: new Date("2026-09-01T00:00:00Z"),
      end: new Date("2026-09-02T00:00:00Z"),
    });

    expect(usage?.tokenBuckets).toEqual([
      {
        modelName: "gpt-4o-mini",
        inputTokens: 105,
        outputTokens: 21,
        cachedTokens: 10,
        reasoningTokens: 0,
        totalTokens: 126,
        requestCount: 3,
      },
    ]);
  });

  it("follows pagination and accumulates totals across pages for the same model", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, {
          object: "page",
          data: [
            {
              object: "bucket",
              start_time: 0,
              end_time: 86400,
              results: [{ input_tokens: 50, output_tokens: 10, input_cached_tokens: 0, num_model_requests: 1, model: "gpt-4o-mini" }],
            },
          ],
          has_more: true,
          next_page: "page-2",
        })
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          object: "page",
          data: [
            {
              object: "bucket",
              start_time: 86400,
              end_time: 172800,
              results: [{ input_tokens: 25, output_tokens: 5, input_cached_tokens: 0, num_model_requests: 1, model: "gpt-4o-mini" }],
            },
          ],
          has_more: false,
          next_page: null,
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    const usage = await new OpenAIProvider("sk-admin-test").getUsage({
      start: new Date("2026-09-01T00:00:00Z"),
      end: new Date("2026-09-03T00:00:00Z"),
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(usage?.tokenBuckets?.[0]).toMatchObject({ inputTokens: 75, outputTokens: 15, requestCount: 2 });
  });
});

describe("OpenAIProvider.getCost", () => {
  it("sums amount.value directly as USD (OpenAI's cost API is not cents)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(200, {
          object: "page",
          data: [
            {
              object: "bucket",
              start_time: 0,
              end_time: 86400,
              results: [
                { object: "organization.costs.result", amount: { value: 0.0042, currency: "usd" }, line_item: "gpt-4o-mini", project_id: null },
                { object: "organization.costs.result", amount: { value: 0.001, currency: "usd" }, line_item: "gpt-4o-mini", project_id: null },
              ],
            },
          ],
          has_more: false,
          next_page: null,
        })
      )
    );

    const cost = await new OpenAIProvider("sk-admin-test").getCost({
      start: new Date("2026-09-01T00:00:00Z"),
      end: new Date("2026-09-02T00:00:00Z"),
    });

    expect(cost?.totalCostUsd).toBeCloseTo(0.0052, 6);
    expect(cost?.byModel).toEqual([{ modelName: "gpt-4o-mini", costUsd: expect.closeTo(0.0052, 6) }]);
  });
});

describe("OpenAIProvider — endpoints with no real data source", () => {
  it("getBalance always returns null (no balance endpoint exists)", async () => {
    expect(await new OpenAIProvider("k").getBalance()).toBeNull();
  });

  it("getRateLimits always returns null (only available via live response headers)", async () => {
    expect(await new OpenAIProvider("k").getRateLimits()).toBeNull();
  });
});
