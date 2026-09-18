// Hand-written types mirroring supabase/migrations/0001_init.sql.
// Regenerate by hand alongside any schema change — there is no live project to codegen from yet.

export type ProviderKind = "llm" | "search";
export type ProviderStatus = "connected" | "disconnected" | "error";
export type CredentialKeyType = "standard" | "admin" | "management";
export type CredentialStatus = "untested" | "valid" | "invalid";
export type UsageSource = "provider_polled" | "self_logged";
export type UsageRecordStatus = "success" | "error";
export type LimitPeriod = "daily" | "monthly";
export type LimitType = "monthly_tokens" | "daily_tokens" | "monthly_spend" | "requests";
export type RateLimitType = "rpm" | "tpm" | "rpd" | string;
export type RateLimitSource = "provider_reported" | "response_headers";
export type AlertLimitType = "usage_limit" | "balance";
export type AlertChannel = "dashboard" | "slack";

export type Provider = {
  id: string;
  name: string;
  slug: string;
  provider_kind: ProviderKind;
  enabled: boolean;
  status: ProviderStatus;
  created_at: string;
  updated_at: string;
}

export type ProviderCredential = {
  id: string;
  provider_id: string;
  key_type: CredentialKeyType;
  name: string;
  encrypted_api_key: string;
  status: CredentialStatus;
  last_tested_at: string | null;
  created_at: string;
  updated_at: string;
}

export type Model = {
  id: string;
  provider_id: string;
  model_name: string;
  display_name: string;
  input_price_per_million: number | null;
  output_price_per_million: number | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export type UsageRecord = {
  id: string;
  provider_id: string;
  model_id: string | null;
  source: UsageSource;
  request_id: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cached_tokens: number | null;
  reasoning_tokens: number | null;
  total_tokens: number | null;
  credits_used: number | null;
  estimated_cost: number | null;
  metadata: Record<string, unknown> | null;
  status: UsageRecordStatus;
  error_code: string | null;
  response_time_ms: number | null;
  created_at: string;
}

export type UsageLimit = {
  id: string;
  provider_id: string;
  model_id: string | null;
  limit_type: LimitType;
  limit_value: number;
  period: LimitPeriod;
  created_at: string;
  updated_at: string;
}

export type RateLimit = {
  id: string;
  provider_id: string;
  model_id: string | null;
  limit_type: RateLimitType;
  current_usage: number | null;
  limit_value: number | null;
  reset_at: string | null;
  source: RateLimitSource;
  created_at: string;
  updated_at: string;
}

export type ApiError = {
  id: string;
  provider_id: string;
  model_id: string | null;
  request_id: string | null;
  status_code: number | null;
  error_code: string | null;
  message: string | null;
  created_at: string;
}

export type Alert = {
  id: string;
  provider_id: string;
  limit_type: AlertLimitType;
  threshold_pct: number;
  period_key: string;
  triggered_at: string;
  channel: AlertChannel;
  delivered: boolean;
  created_at: string;
}

export type Profile = {
  id: string;
  email: string;
  role: string;
  created_at: string;
  updated_at: string;
}

export interface UsageSummaryByProviderRow {
  provider_id: string;
  input_tokens: number;
  output_tokens: number;
  cached_tokens: number;
  total_tokens: number;
  credits_used: number;
  // null when no summed row has a known cost (e.g. Gemini) — never a
  // fabricated 0. See supabase/migrations/0003_fix_estimated_cost_unknown.sql.
  estimated_cost: number | null;
  request_count: number;
}

export interface UsageTimelineFnRow {
  bucket: string;
  provider_id: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  estimated_cost: number | null;
  request_count: number;
}

export interface UsageByModelFnRow {
  provider_id: string;
  model_id: string | null;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  estimated_cost: number | null;
  request_count: number;
}

// A no-op helper so every table literal below stays short — postgrest-js
// requires a `Relationships` array on each table (we declare none; this app
// never uses PostgREST's embedded-resource `select`).
type NoRelationships = { Relationships: [] };
type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
} & NoRelationships;

export interface Database {
  public: {
    Tables: {
      profiles: Table<Profile>;
      providers: Table<Provider>;
      provider_credentials: Table<ProviderCredential>;
      models: Table<Model>;
      usage_records: Table<UsageRecord>;
      usage_limits: Table<UsageLimit>;
      rate_limits: Table<RateLimit>;
      api_errors: Table<ApiError>;
      alerts: Table<Alert>;
    };
    Views: Record<string, never>;
    Functions: {
      usage_summary_by_provider: {
        Args: { p_start: string; p_end: string };
        Returns: UsageSummaryByProviderRow[];
      };
      usage_timeline: {
        Args: { p_start: string; p_end: string; p_provider_id: string | null };
        Returns: UsageTimelineFnRow[];
      };
      usage_by_model: {
        Args: { p_start: string; p_end: string };
        Returns: UsageByModelFnRow[];
      };
    };
  };
}
