import "server-only";
import { fetchJson, ProviderHttpError } from "./http";
import type {
  AIProvider,
  BalanceReport,
  CostReport,
  ProviderModel,
  RateLimitEntry,
  TestConnectionResult,
  UsageReport,
} from "./types";

const BASE_URL = "https://api.perplexity.ai";

interface PerplexityUsage {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  input_tokens_details?: { cache_read_input_tokens?: number };
}

interface PerplexityCost {
  currency: string;
  total_cost: number;
}

interface PerplexityAgentResponse {
  usage?: PerplexityUsage;
  cost?: PerplexityCost;
}

interface PerplexityModelsList {
  object: "list";
  data: { id: string }[];
}

/**
 * Perplexity API client — reuses the standard API key. As of this writing
 * Perplexity has no account-level usage/cost/quota API at all (confirmed
 * against current docs); the only real usage+cost data is the `usage`/`cost`
 * block returned inside a single Agent API (`POST /v1/agent`) response —
 * same shape of limitation as Gemini, except Perplexity's per-call response
 * also exposes a genuine USD cost, which the Test Connection ping captures
 * as a self_logged sample. getUsage/getCost/getRateLimits intentionally
 * return null — do not invent an aggregate endpoint.
 */
export class PerplexityProvider implements AIProvider {
  slug = "perplexity";
  kind = "llm" as const;

  constructor(private readonly apiKey: string) {}

  private headers() {
    return { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" };
  }

  async testConnection(): Promise<TestConnectionResult> {
    try {
      const res = await fetchJson<PerplexityAgentResponse>(`${BASE_URL}/v1/agent`, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({ input: "ping", model: "sonar" }),
      });
      const usage = res.usage;
      const cost = res.cost;
      return {
        ok: true,
        message: cost
          ? `Connected. This ping cost $${cost.total_cost.toFixed(6)} ${cost.currency}, logged as a self-logged sample only.`
          : "Connected. This ping's usage was logged as a self-logged sample only.",
        usageSample: usage
          ? {
              modelName: "sonar",
              inputTokens: usage.input_tokens ?? 0,
              outputTokens: usage.output_tokens ?? 0,
              cachedTokens: usage.input_tokens_details?.cache_read_input_tokens ?? 0,
              reasoningTokens: 0,
              totalTokens: usage.total_tokens ?? 0,
              requestCount: 1,
            }
          : undefined,
        costUsdSample: cost?.total_cost,
      };
    } catch (err) {
      if (err instanceof ProviderHttpError && (err.status === 401 || err.status === 403)) {
        return { ok: false, message: "API key is invalid." };
      }
      return { ok: false, message: err instanceof Error ? err.message : "Connection failed." };
    }
  }

  async getModels(): Promise<ProviderModel[] | null> {
    try {
      const res = await fetchJson<PerplexityModelsList>(`${BASE_URL}/v1/models`, { headers: this.headers() });
      return res.data.map((m) => ({ modelName: m.id, displayName: m.id }));
    } catch {
      return null;
    }
  }

  async getUsage(): Promise<UsageReport | null> {
    return null;
  }

  async getCost(): Promise<CostReport | null> {
    return null;
  }

  async getBalance(): Promise<BalanceReport | null> {
    return null;
  }

  async getRateLimits(): Promise<RateLimitEntry[] | null> {
    return null;
  }
}
