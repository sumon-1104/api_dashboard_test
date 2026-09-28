import "server-only";
import { fetchJson, ProviderHttpError } from "./http";
import type {
  AIProvider,
  BalanceReport,
  CostReport,
  ProviderModel,
  RateLimitEntry,
  TestConnectionResult,
  UsageCreditsBucket,
  UsageReport,
} from "./types";

const BASE_URL = "https://api.tavily.com";

interface TavilyUsageResponse {
  key: {
    usage: number;
    limit: number | null;
    search_usage: number;
    extract_usage: number;
    crawl_usage: number;
    map_usage: number;
    research_usage: number;
  };
  account: {
    current_plan: string;
  };
}

/**
 * Tavily API client — reuses the standard API key. `GET /usage` reports
 * *cumulative credits for the current billing cycle*, not a queryable
 * historical range like OpenAI/Anthropic's per-day buckets — there is no way
 * to ask "how many credits were used on 2026-09-15." getUsage() therefore
 * ignores the requested range and always returns the current cycle's totals;
 * the poller (lib/usage/poll.ts) replaces this credential's entire history
 * on every poll instead of just "today's" slice, so a multi-day query never
 * double-counts the same cumulative number across several days.
 */
export class TavilyProvider implements AIProvider {
  slug = "tavily";
  kind = "search" as const;

  constructor(private readonly apiKey: string) {}

  private headers() {
    return { Authorization: `Bearer ${this.apiKey}` };
  }

  private async fetchUsage(): Promise<TavilyUsageResponse> {
    return fetchJson<TavilyUsageResponse>(`${BASE_URL}/usage`, { headers: this.headers() });
  }

  async testConnection(): Promise<TestConnectionResult> {
    try {
      const res = await this.fetchUsage();
      const limit = res.key.limit != null ? res.key.limit.toLocaleString() : "unlimited";
      return {
        ok: true,
        message: `Connected. Plan: ${res.account.current_plan}. Key usage: ${res.key.usage.toLocaleString()}/${limit} credits this cycle.`,
      };
    } catch (err) {
      if (err instanceof ProviderHttpError && (err.status === 401 || err.status === 403)) {
        return { ok: false, message: "API key is invalid." };
      }
      return { ok: false, message: err instanceof Error ? err.message : "Connection failed." };
    }
  }

  async getModels(): Promise<ProviderModel[] | null> {
    // Search-kind provider — no models to enumerate.
    return null;
  }

  async getUsage(): Promise<UsageReport | null> {
    try {
      const res = await this.fetchUsage();
      const k = res.key;
      const creditBuckets: UsageCreditsBucket[] = [
        { endpoint: "search", creditsUsed: k.search_usage, requestCount: null },
        { endpoint: "extract", creditsUsed: k.extract_usage, requestCount: null },
        { endpoint: "crawl", creditsUsed: k.crawl_usage, requestCount: null },
        { endpoint: "map", creditsUsed: k.map_usage, requestCount: null },
        { endpoint: "research", creditsUsed: k.research_usage, requestCount: null },
      ];
      return { kind: "search", creditBuckets };
    } catch {
      return null;
    }
  }

  async getCost(): Promise<CostReport | null> {
    // /usage reports credits, not USD — this app doesn't know Tavily's
    // price-per-credit for the caller's specific plan, so never convert.
    return null;
  }

  async getBalance(): Promise<BalanceReport | null> {
    // Credits, not a currency balance — see getRateLimits() for the
    // credits-used/credits-limit pair instead.
    return null;
  }

  async getRateLimits(): Promise<RateLimitEntry[] | null> {
    try {
      const res = await this.fetchUsage();
      return [
        {
          limitType: "plan_credits",
          currentUsage: res.key.usage,
          limitValue: res.key.limit,
          resetAt: null,
          source: "provider_reported",
        },
      ];
    } catch {
      return null;
    }
  }
}
