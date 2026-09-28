import { afterEach, describe, expect, it, vi } from "vitest";
import { DeepSeekProvider } from "./deepseek";

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

describe("DeepSeekProvider.testConnection", () => {
  it("reports the real balance from /user/balance", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(200, {
          is_available: true,
          balance_infos: [{ currency: "USD", total_balance: "110.00", granted_balance: "10.00", topped_up_balance: "100.00" }],
        })
      )
    );

    const result = await new DeepSeekProvider("sk-test").testConnection();

    expect(result.ok).toBe(true);
    expect(result.message).toMatch(/110\.00 USD/);
  });

  it("flags an invalid key on 401", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(401, { error: "invalid" })));

    const result = await new DeepSeekProvider("bad").testConnection();

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/invalid/);
  });
});

describe("DeepSeekProvider.getBalance", () => {
  it("parses the real balance as a number, never estimated", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(200, {
          is_available: true,
          balance_infos: [{ currency: "USD", total_balance: "42.50", granted_balance: "0", topped_up_balance: "42.50" }],
        })
      )
    );

    const balance = await new DeepSeekProvider("sk-test").getBalance();

    expect(balance).toEqual({ amount: 42.5, currency: "USD" });
  });

  it("returns null on failure rather than a fabricated balance", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(500, { error: "down" })));

    expect(await new DeepSeekProvider("sk-test").getBalance()).toBeNull();
  });
});

describe("DeepSeekProvider — no usage-by-model API", () => {
  it("getUsage/getCost/getRateLimits always return null", async () => {
    const provider = new DeepSeekProvider("sk-test");
    expect(await provider.getUsage()).toBeNull();
    expect(await provider.getCost()).toBeNull();
    expect(await provider.getRateLimits()).toBeNull();
  });
});

describe("DeepSeekProvider.getModels", () => {
  it("maps the OpenAI-compatible models list", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(200, { object: "list", data: [{ id: "deepseek-chat", object: "model", owned_by: "deepseek" }] }))
    );

    const models = await new DeepSeekProvider("sk-test").getModels();

    expect(models).toEqual([{ modelName: "deepseek-chat", displayName: "deepseek-chat" }]);
  });
});
