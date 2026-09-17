import "server-only";

export type ProviderKind = "llm" | "search";

export interface DateRange {
  start: Date;
  end: Date;
}

export interface ProviderModel {
  modelName: string;
  displayName: string;
}

// Token-shaped usage bucket (LLM providers). A search-kind provider reports
// through UsageCreditsBucket instead — never force credits through this shape.
export interface UsageTokensBucket {
  modelName: string | null;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  reasoningTokens: number;
  totalTokens: number;
  // null where the provider's usage report doesn't include a request count
  // (e.g. Anthropic's usage_report/messages has no request-count field).
  requestCount: number | null;
}

// Credit-shaped usage bucket (search providers like Tavily): no tokens, no
// per-token price, just credits spent per endpoint.
export interface UsageCreditsBucket {
  endpoint: string;
  creditsUsed: number;
  requestCount: number;
}

export interface UsageReport {
  kind: ProviderKind;
  tokenBuckets?: UsageTokensBucket[];
  creditBuckets?: UsageCreditsBucket[];
}

export interface CostReport {
  totalCostUsd: number;
  byModel?: { modelName: string; costUsd: number }[];
}

export interface BalanceReport {
  amount: number;
  currency: string;
}

// A rate limit a provider genuinely reports — either a *configured* limit
// (Anthropic's Rate Limits API) or one read from a live call's response
// headers. Never a number this app invented.
export interface RateLimitEntry {
  limitType: string; // 'rpm' | 'tpm' | 'rpd' | ...
  currentUsage: number | null;
  limitValue: number | null;
  resetAt: Date | null;
  source: "provider_reported" | "response_headers";
}

export interface TestConnectionResult {
  ok: boolean;
  message: string;
  raw?: unknown;
}

/**
 * One implementation per provider, in lib/providers/<slug>.ts. Every method
 * that a provider cannot genuinely answer returns null — never a guessed or
 * fabricated number. See CLAUDE.md "Provider architecture" for the
 * polled-vs-self-logged distinction and the llm-vs-search provider_kind split.
 */
export interface AIProvider {
  slug: string;
  kind: ProviderKind;

  testConnection(): Promise<TestConnectionResult>;
  getModels(): Promise<ProviderModel[] | null>;
  getUsage(range: DateRange): Promise<UsageReport | null>;
  getCost(range: DateRange): Promise<CostReport | null>;
  getBalance(): Promise<BalanceReport | null>;
  getRateLimits(): Promise<RateLimitEntry[] | null>;
}

export class ProviderCredentialError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderCredentialError";
  }
}
