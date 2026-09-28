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

const MANAGEMENT_BASE_URL = "https://management-api.x.ai";

interface XaiPrepaidBalance {
  balance: string;
  currency: string;
}

/**
 * xAI Management API client — reuses a separate *management*-scoped key
 * (console.x.ai → Settings → Management Keys), not a regular xAI API key.
 * Also requires a team_id that has no discovery endpoint — it must be copied
 * manually from console.x.ai/team/default/settings/team and is stored as
 * non-secret provider_credentials.config, not part of the encrypted key.
 * Without it every call below fails fast with a clear message rather than
 * guessing a team.
 *
 * As of this writing there is no documented usage-by-model endpoint reachable
 * without the complex analytics query API (undocumented metric names) — only
 * the prepaid balance is implemented; getUsage/getCost/getRateLimits stay null.
 */
export class XaiProvider implements AIProvider {
  slug = "xai";
  kind = "llm" as const;

  constructor(
    private readonly managementKey: string,
    private readonly teamId: string | null
  ) {}

  private headers() {
    return { Authorization: `Bearer ${this.managementKey}` };
  }

  private requireTeamId(): string {
    if (!this.teamId) {
      throw new Error("No Team ID stored for this key — remove and re-add it with your Team ID from console.x.ai.");
    }
    return this.teamId;
  }

  async testConnection(): Promise<TestConnectionResult> {
    try {
      const teamId = this.requireTeamId();
      const res = await fetchJson<XaiPrepaidBalance>(`${MANAGEMENT_BASE_URL}/v1/billing/teams/${teamId}/prepaid/balance`, {
        headers: this.headers(),
      });
      return { ok: true, message: `Connected. Prepaid balance: ${res.balance} ${res.currency}.` };
    } catch (err) {
      if (err instanceof ProviderHttpError && (err.status === 401 || err.status === 403)) {
        return { ok: false, message: "Management key is invalid or lacks billing access." };
      }
      return { ok: false, message: err instanceof Error ? err.message : "Connection failed." };
    }
  }

  async getModels(): Promise<ProviderModel[] | null> {
    // The management key is billing/team-scoped, not for model listing —
    // and models are otherwise curated manually on the Models page.
    return null;
  }

  async getUsage(): Promise<UsageReport | null> {
    // Only reachable via the undocumented analytics query API (unconfirmed
    // metric names) — do not guess a "cost"/"tokens" field name.
    return null;
  }

  async getCost(): Promise<CostReport | null> {
    return null;
  }

  async getBalance(): Promise<BalanceReport | null> {
    try {
      const teamId = this.requireTeamId();
      const res = await fetchJson<XaiPrepaidBalance>(`${MANAGEMENT_BASE_URL}/v1/billing/teams/${teamId}/prepaid/balance`, {
        headers: this.headers(),
      });
      return { amount: Number(res.balance), currency: res.currency };
    } catch {
      return null;
    }
  }

  async getRateLimits(): Promise<RateLimitEntry[] | null> {
    return null;
  }
}
