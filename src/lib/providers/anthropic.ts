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

const BASE_URL = "https://api.anthropic.com/v1";
const ANTHROPIC_VERSION = "2023-06-01";

interface AnthropicUsageResult {
  model: string | null;
  uncached_input_tokens: number;
  cache_read_input_tokens: number;
  cache_creation: { ephemeral_1h_input_tokens: number; ephemeral_5m_input_tokens: number };
  output_tokens: number;
}

interface AnthropicUsageBucket {
  starting_at: string;
  ending_at: string;
  results: AnthropicUsageResult[];
}

interface AnthropicUsagePage {
  data: AnthropicUsageBucket[];
  has_more: boolean;
  next_page: string | null;
}

interface AnthropicCostResult {
  amount: string; // decimal string, lowest currency units (cents)
  currency: string;
  description: string | null;
}

interface AnthropicCostBucket {
  starting_at: string;
  ending_at: string;
  results: AnthropicCostResult[];
}

interface AnthropicCostPage {
  data: AnthropicCostBucket[];
  has_more: boolean;
  next_page: string | null;
}

interface AnthropicRateLimitGroup {
  group_type: string;
  models: string[] | null;
  limits: { type: string; value: number }[];
}

interface AnthropicRateLimitPage {
  data: AnthropicRateLimitGroup[];
  next_page: string | null;
}

interface AnthropicModelsList {
  data: { id: string; display_name?: string }[];
}

/**
 * Anthropic Admin Usage/Cost/Rate-Limits API client.
 *
 * Auth: requires an Admin API key (`sk-ant-admin01-...`) or an OAuth token
 * with `org:admin` scope — a normal workspace key will not authenticate
 * against these endpoints. Data lands ~5 minutes after a request completes;
 * Anthropic's own guidance caps sustained polling at once per minute.
 */
export class AnthropicProvider implements AIProvider {
  slug = "anthropic";
  kind = "llm" as const;

  constructor(private readonly adminKey: string) {}

  private headers() {
    return {
      "x-api-key": this.adminKey,
      "anthropic-version": ANTHROPIC_VERSION,
    };
  }

  async testConnection(): Promise<TestConnectionResult> {
    try {
      await fetchJson<AnthropicRateLimitPage>(`${BASE_URL}/organizations/rate_limits`, {
        headers: this.headers(),
      });
      return { ok: true, message: "Connected using Admin API key." };
    } catch (err) {
      if (err instanceof ProviderHttpError && (err.status === 401 || err.status === 403)) {
        return { ok: false, message: "Admin API key/OAuth token is invalid or lacks org:admin scope." };
      }
      return { ok: false, message: err instanceof Error ? err.message : "Connection failed." };
    }
  }

  async getModels(): Promise<ProviderModel[] | null> {
    try {
      const res = await fetchJson<AnthropicModelsList>(`${BASE_URL}/models`, { headers: this.headers() });
      return res.data.map((m) => ({ modelName: m.id, displayName: m.display_name ?? m.id }));
    } catch {
      return null;
    }
  }

  async getUsage(range: DateRange): Promise<UsageReport | null> {
    const buckets = new Map<string, UsageTokensBucket>();
    let page: string | undefined;

    do {
      const params = new URLSearchParams({
        starting_at: range.start.toISOString(),
        ending_at: range.end.toISOString(),
        bucket_width: "1d",
        limit: "31",
      });
      params.append("group_by[]", "model");
      if (page) params.set("page", page);

      const res = await fetchJson<AnthropicUsagePage>(`${BASE_URL}/organizations/usage_report/messages?${params}`, {
        headers: this.headers(),
      });

      for (const bucket of res.data) {
        for (const r of bucket.results) {
          const key = r.model ?? "unknown";
          const cacheCreation =
            (r.cache_creation?.ephemeral_1h_input_tokens ?? 0) + (r.cache_creation?.ephemeral_5m_input_tokens ?? 0);
          const cachedTokens = (r.cache_read_input_tokens ?? 0) + cacheCreation;
          const existing = buckets.get(key) ?? {
            modelName: r.model,
            inputTokens: 0,
            outputTokens: 0,
            cachedTokens: 0,
            reasoningTokens: 0,
            totalTokens: 0,
            requestCount: null, // Anthropic's usage report has no request-count field
          };
          existing.inputTokens += r.uncached_input_tokens ?? 0;
          existing.outputTokens += r.output_tokens ?? 0;
          existing.cachedTokens += cachedTokens;
          existing.totalTokens += (r.uncached_input_tokens ?? 0) + (r.output_tokens ?? 0) + cachedTokens;
          buckets.set(key, existing);
        }
      }

      page = res.has_more ? (res.next_page ?? undefined) : undefined;
    } while (page);

    return { kind: "llm", tokenBuckets: Array.from(buckets.values()) };
  }

  async getCost(range: DateRange): Promise<CostReport | null> {
    let totalCents = 0;
    let page: string | undefined;

    do {
      const params = new URLSearchParams({
        starting_at: range.start.toISOString(),
        ending_at: range.end.toISOString(),
        bucket_width: "1d",
        limit: "31",
      });
      if (page) params.set("page", page);

      const res = await fetchJson<AnthropicCostPage>(`${BASE_URL}/organizations/cost_report?${params}`, {
        headers: this.headers(),
      });

      for (const bucket of res.data) {
        for (const r of bucket.results) {
          totalCents += Number.parseFloat(r.amount ?? "0");
        }
      }

      page = res.has_more ? (res.next_page ?? undefined) : undefined;
    } while (page);

    // Amounts are in the lowest currency unit (cents) per the Cost API docs.
    return { totalCostUsd: totalCents / 100 };
  }

  async getBalance(): Promise<BalanceReport | null> {
    // No balance/quota endpoint beyond configured rate limits — "Not available."
    return null;
  }

  async getRateLimits(): Promise<RateLimitEntry[] | null> {
    try {
      const res = await fetchJson<AnthropicRateLimitPage>(`${BASE_URL}/organizations/rate_limits`, {
        headers: this.headers(),
      });

      const entries: RateLimitEntry[] = [];
      for (const group of res.data) {
        for (const limit of group.limits) {
          entries.push({
            limitType: limit.type,
            currentUsage: null, // configured limit only, not a live remaining count
            limitValue: limit.value,
            resetAt: null,
            source: "provider_reported",
          });
        }
      }
      return entries;
    } catch {
      return null;
    }
  }
}
