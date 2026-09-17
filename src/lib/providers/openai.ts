import "server-only";
import { fetchJson, ProviderHttpError } from "./http";
import type {
  AIProvider,
  BalanceReport,
  CostReport,
  DateRange,
  ProviderModel,
  RateLimitEntry,
  TestConnectionResult,
  UsageReport,
  UsageTokensBucket,
} from "./types";

const BASE_URL = "https://api.openai.com/v1";

interface OpenAIUsageResult {
  input_tokens: number;
  output_tokens: number;
  input_cached_tokens: number;
  num_model_requests: number;
  model: string | null;
}

interface OpenAIUsageBucket {
  object: "bucket";
  start_time: number;
  end_time: number;
  results: OpenAIUsageResult[];
}

interface OpenAIUsagePage {
  object: "page";
  data: OpenAIUsageBucket[];
  has_more: boolean;
  next_page: string | null;
}

interface OpenAICostResult {
  object: "organization.costs.result";
  amount: { value: number; currency: string };
  line_item: string | null;
  project_id: string | null;
}

interface OpenAICostBucket {
  object: "bucket";
  start_time: number;
  end_time: number;
  results: OpenAICostResult[];
}

interface OpenAICostPage {
  object: "page";
  data: OpenAICostBucket[];
  has_more: boolean;
  next_page: string | null;
}

interface OpenAIModelsList {
  object: "list";
  data: { id: string }[];
}

function toUnixSeconds(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

/**
 * OpenAI Admin Usage/Cost API client.
 *
 * Auth: requires an Admin API key (organization settings → Admin keys), not a
 * standard project key. There is no OpenAI endpoint for remaining balance or
 * for querying rate limits out of band — those only ever come from the
 * x-ratelimit-* headers of a live call, which this poller never makes.
 */
export class OpenAIProvider implements AIProvider {
  slug = "openai";
  kind = "llm" as const;

  constructor(private readonly adminKey: string) {}

  private headers() {
    return { Authorization: `Bearer ${this.adminKey}` };
  }

  async testConnection(): Promise<TestConnectionResult> {
    try {
      const startTime = toUnixSeconds(new Date(Date.now() - 60 * 60 * 1000));
      await fetchJson<OpenAIUsagePage>(
        `${BASE_URL}/organization/usage/completions?start_time=${startTime}&limit=1`,
        { headers: this.headers() }
      );
      return { ok: true, message: "Connected using Admin API key." };
    } catch (err) {
      if (err instanceof ProviderHttpError && (err.status === 401 || err.status === 403)) {
        return { ok: false, message: "Admin API key is invalid or lacks organization access." };
      }
      return { ok: false, message: err instanceof Error ? err.message : "Connection failed." };
    }
  }

  async getModels(): Promise<ProviderModel[] | null> {
    // Best-effort: /v1/models is project-scoped and may reject an org-level
    // admin key. Models for this provider are otherwise curated manually in
    // the Models page, so a failure here is not fatal — just return null.
    try {
      const res = await fetchJson<OpenAIModelsList>(`${BASE_URL}/models`, { headers: this.headers() });
      return res.data.map((m) => ({ modelName: m.id, displayName: m.id }));
    } catch {
      return null;
    }
  }

  async getUsage(range: DateRange): Promise<UsageReport | null> {
    const buckets = new Map<string, UsageTokensBucket>();
    let page: string | undefined;

    do {
      const params = new URLSearchParams({
        start_time: String(toUnixSeconds(range.start)),
        end_time: String(toUnixSeconds(range.end)),
        bucket_width: "1d",
        limit: "31",
      });
      params.append("group_by[]", "model");
      if (page) params.set("page", page);

      const res = await fetchJson<OpenAIUsagePage>(`${BASE_URL}/organization/usage/completions?${params}`, {
        headers: this.headers(),
      });

      for (const bucket of res.data) {
        for (const r of bucket.results) {
          const key = r.model ?? "unknown";
          const existing = buckets.get(key) ?? {
            modelName: r.model,
            inputTokens: 0,
            outputTokens: 0,
            cachedTokens: 0,
            reasoningTokens: 0,
            totalTokens: 0,
            requestCount: 0,
          };
          existing.inputTokens += r.input_tokens ?? 0;
          existing.outputTokens += r.output_tokens ?? 0;
          existing.cachedTokens += r.input_cached_tokens ?? 0;
          existing.totalTokens += (r.input_tokens ?? 0) + (r.output_tokens ?? 0);
          existing.requestCount = (existing.requestCount ?? 0) + (r.num_model_requests ?? 0);
          buckets.set(key, existing);
        }
      }

      page = res.has_more ? (res.next_page ?? undefined) : undefined;
    } while (page);

    return { kind: "llm", tokenBuckets: Array.from(buckets.values()) };
  }

  async getCost(range: DateRange): Promise<CostReport | null> {
    const byModel = new Map<string, number>();
    let total = 0;
    let page: string | undefined;

    do {
      const params = new URLSearchParams({
        start_time: String(toUnixSeconds(range.start)),
        end_time: String(toUnixSeconds(range.end)),
        limit: "31",
      });
      if (page) params.set("page", page);

      const res = await fetchJson<OpenAICostPage>(`${BASE_URL}/organization/costs?${params}`, {
        headers: this.headers(),
      });

      for (const bucket of res.data) {
        for (const r of bucket.results) {
          total += r.amount?.value ?? 0;
          const key = r.line_item ?? "total";
          byModel.set(key, (byModel.get(key) ?? 0) + (r.amount?.value ?? 0));
        }
      }

      page = res.has_more ? (res.next_page ?? undefined) : undefined;
    } while (page);

    return {
      totalCostUsd: total,
      byModel: Array.from(byModel.entries()).map(([modelName, costUsd]) => ({ modelName, costUsd })),
    };
  }

  async getBalance(): Promise<BalanceReport | null> {
    // No such endpoint exists for OpenAI — always "Not available."
    return null;
  }

  async getRateLimits(): Promise<RateLimitEntry[] | null> {
    // Not pollable: OpenAI only exposes rate-limit numbers in the
    // x-ratelimit-* headers of a live completions call, which this poller
    // never makes. Would need a proxy/self-logging path to capture.
    return null;
  }
}
