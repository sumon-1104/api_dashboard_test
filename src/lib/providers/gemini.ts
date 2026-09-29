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

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

interface GeminiModelsList {
  models: { name: string; displayName: string }[];
}

interface GeminiUsageMetadata {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  cachedContentTokenCount?: number;
  thoughtsTokenCount?: number;
  totalTokenCount?: number;
}

interface GeminiGenerateContentResponse {
  usageMetadata?: GeminiUsageMetadata;
}

/**
 * Gemini API key client — NOT a poller.
 *
 * As of this writing, a standard Gemini API / AI Studio key has no aggregate
 * usage, cost, or quota endpoint at all. The only usage data Google returns
 * is the `usageMetadata` block inside a single `generateContent` response.
 * Do not "fix" this by inventing an endpoint — getUsage/getCost/getRateLimits
 * intentionally return null so the UI renders "Not available from provider."
 */
export class GeminiProvider implements AIProvider {
  slug = "gemini";
  kind = "llm" as const;

  constructor(private readonly apiKey: string) {}

  async testConnection(): Promise<TestConnectionResult> {
    try {
      const res = await fetchJson<GeminiGenerateContentResponse>(
        `${BASE_URL}/models/gemini-flash-latest:generateContent?key=${this.apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: "ping" }] }],
            generationConfig: { maxOutputTokens: 1 },
          }),
          // Under real-world high-demand periods, Gemini can take >15s to
          // respond even for a successful call (observed directly: a real
          // ping took ~20s end to end) — the default timeout is too tight
          // for this provider specifically.
          timeoutMs: 30_000,
        }
      );
      const usage = res.usageMetadata;
      return {
        ok: true,
        message: "Connected. This ping's usageMetadata was logged as a self-logged sample only.",
        usageSample: {
          modelName: "gemini-flash-latest",
          inputTokens: usage?.promptTokenCount ?? 0,
          outputTokens: usage?.candidatesTokenCount ?? 0,
          cachedTokens: usage?.cachedContentTokenCount ?? 0,
          reasoningTokens: usage?.thoughtsTokenCount ?? 0,
          totalTokens: usage?.totalTokenCount ?? 0,
          requestCount: 1,
        },
      };
    } catch (err) {
      if (err instanceof ProviderHttpError && (err.status === 401 || err.status === 403)) {
        return { ok: false, message: "API key is invalid or lacks Gemini API access." };
      }
      return { ok: false, message: err instanceof Error ? err.message : "Connection failed." };
    }
  }

  async getModels(): Promise<ProviderModel[] | null> {
    try {
      const res = await fetchJson<GeminiModelsList>(`${BASE_URL}/models?key=${this.apiKey}`);
      return res.models.map((m) => ({
        modelName: m.name.replace(/^models\//, ""),
        displayName: m.displayName,
      }));
    } catch {
      return null;
    }
  }

  async getUsage(): Promise<UsageReport | null> {
    // No aggregate usage API exists for a Gemini API key. Real per-call
    // usageMetadata is captured as a self_logged usage_record only when a
    // live call is made (e.g. the Test Connection ping above) — never
    // synthesized here.
    return null;
  }

  async getCost(): Promise<CostReport | null> {
    return null;
  }

  async getBalance(): Promise<BalanceReport | null> {
    return null;
  }

  async getRateLimits(): Promise<RateLimitEntry[] | null> {
    // RPM/TPM/RPD vary by tier and are not exposed via any endpoint — do not
    // estimate or hard-code them.
    return null;
  }
}
