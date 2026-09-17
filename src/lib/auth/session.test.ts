import { beforeEach, describe, expect, it } from "vitest";
import { requireCronSecret } from "./session";

describe("requireCronSecret", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "test-secret";
  });

  it("rejects a request with no x-cron-secret header", async () => {
    const req = new Request("https://example.com/api/cron/poll-usage", { method: "POST" });
    const result = requireCronSecret(req);
    expect(result).not.toBeNull();
    expect(result?.status).toBe(401);
  });

  it("rejects a request with the wrong secret", async () => {
    const req = new Request("https://example.com/api/cron/poll-usage", {
      method: "POST",
      headers: { "x-cron-secret": "wrong" },
    });
    expect(requireCronSecret(req)?.status).toBe(401);
  });

  it("accepts a request with the correct secret", async () => {
    const req = new Request("https://example.com/api/cron/poll-usage", {
      method: "POST",
      headers: { "x-cron-secret": "test-secret" },
    });
    expect(requireCronSecret(req)).toBeNull();
  });

  it("rejects every request when CRON_SECRET is unset", async () => {
    delete process.env.CRON_SECRET;
    const req = new Request("https://example.com/api/cron/poll-usage", {
      method: "POST",
      headers: { "x-cron-secret": "anything" },
    });
    expect(requireCronSecret(req)?.status).toBe(401);
  });
});
