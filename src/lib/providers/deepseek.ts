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

const BASE_URL = "https://api.deepseek.com";

interface DeepSeekBalanceInfo {
  currency: string;
  total_balance: string;
  granted_balance: string;
  topped_up_balance: string;
}

interface DeepSeekBalanceResponse {
  is_available: boolean;
  balance_infos: DeepSeekBalanceInfo[];
}

interface DeepSeekModelsList {
  object: "list";
  data: { id: string; object: "model"; owned_by: string }[];
}

/**
 * DeepSeek API client — reuses the standard API key (no separate admin
 * tier). As of this writing DeepSeek exposes no usage/cost-by-model
 * breakdown endpoint, only a live account balance — getUsage/getCost/
 * getRateLimits intentionally return null rather than estimate from price.
 */
export class DeepSeekProvider implements AIProvider {
  slug = "deepseek";
  kind = "llm" as const;

  constructor(private readonly apiKey: string) {}

  private headers() {
    return { Authorization: `Bearer ${this.apiKey}` };
  }

  async testConnection(): Promise<TestConnectionResult> {
    try {
      const res = await fetchJson<DeepSeekBalanceResponse>(`${BASE_URL}/user/balance`, { headers: this.headers() });
      const info = res.balance_infos?.[0];
      const message = info
        ? `Connected. Balance: ${info.total_balance} ${info.currency}${res.is_available ? "" : " (insufficient for API calls)"}.`
        : "Connected.";
      return { ok: true, message };
    } catch (err) {
      if (err instanceof ProviderHttpError && (err.status === 401 || err.status === 403)) {
        return { ok: false, message: "API key is invalid." };
      }
      return { ok: false, message: err instanceof Error ? err.message : "Connection failed." };
    }
  }

  async getModels(): Promise<ProviderModel[] | null> {
    try {
      const res = await fetchJson<DeepSeekModelsList>(`${BASE_URL}/models`, { headers: this.headers() });
      return res.data.map((m) => ({ modelName: m.id, displayName: m.id }));
    } catch {
      return null;
    }
  }

  async getUsage(): Promise<UsageReport | null> {
    // No usage-by-model or historical usage endpoint exists for a standard
    // DeepSeek key — only the live balance below. Do not estimate from cost.
    return null;
  }

  async getCost(): Promise<CostReport | null> {
    return null;
  }

  async getBalance(): Promise<BalanceReport | null> {
    try {
      const res = await fetchJson<DeepSeekBalanceResponse>(`${BASE_URL}/user/balance`, { headers: this.headers() });
      const info = res.balance_infos?.[0];
      if (!info) return null;
      return { amount: Number(info.total_balance), currency: info.currency };
    } catch {
      return null;
    }
  }

  async getRateLimits(): Promise<RateLimitEntry[] | null> {
    // Not documented/exposed via any endpoint — do not estimate.
    return null;
  }
}
