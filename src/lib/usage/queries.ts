import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type Client = SupabaseClient<Database>;

export interface UsageSummaryRow {
  provider_id: string;
  input_tokens: number;
  output_tokens: number;
  cached_tokens: number;
  total_tokens: number;
  credits_used: number;
  // null when nothing summed has a known cost — never a fabricated 0.
  estimated_cost: number | null;
  request_count: number;
}

export interface UsageTimelineRow {
  bucket: string;
  provider_id: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  estimated_cost: number | null;
  request_count: number;
}

export interface UsageByModelRow {
  provider_id: string;
  model_id: string | null;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  estimated_cost: number | null;
  request_count: number;
}

export async function getProviders(supabase: Client) {
  const { data, error } = await supabase.from("providers").select("*").order("name");
  if (error) throw error;
  return data;
}

export async function getModels(supabase: Client) {
  const { data, error } = await supabase.from("models").select("*").order("display_name");
  if (error) throw error;
  return data;
}

export async function getUsageSummaryByProvider(
  supabase: Client,
  range: { start: Date; end: Date }
): Promise<UsageSummaryRow[]> {
  const { data, error } = await supabase.rpc("usage_summary_by_provider", {
    p_start: range.start.toISOString(),
    p_end: range.end.toISOString(),
  });
  if (error) throw error;
  return (data ?? []) as UsageSummaryRow[];
}

export async function getUsageTimeline(
  supabase: Client,
  range: { start: Date; end: Date },
  providerId?: string
): Promise<UsageTimelineRow[]> {
  const { data, error } = await supabase.rpc("usage_timeline", {
    p_start: range.start.toISOString(),
    p_end: range.end.toISOString(),
    p_provider_id: providerId ?? null,
  });
  if (error) throw error;
  return (data ?? []) as UsageTimelineRow[];
}

export async function getUsageByModel(
  supabase: Client,
  range: { start: Date; end: Date }
): Promise<UsageByModelRow[]> {
  const { data, error } = await supabase.rpc("usage_by_model", {
    p_start: range.start.toISOString(),
    p_end: range.end.toISOString(),
  });
  if (error) throw error;
  return (data ?? []) as UsageByModelRow[];
}

export async function getUsageLimits(supabase: Client) {
  const { data, error } = await supabase.from("usage_limits").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getRateLimits(supabase: Client) {
  const { data, error } = await supabase.from("rate_limits").select("*").order("updated_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getRecentErrors(
  supabase: Client,
  opts: { page?: number; pageSize?: number; providerId?: string } = {}
) {
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 25;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("api_errors")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (opts.providerId) query = query.eq("provider_id", opts.providerId);

  const { data, error, count } = await query;
  if (error) throw error;
  return { data, count: count ?? 0, page, pageSize };
}

export async function getRecentAlerts(supabase: Client, limit = 10) {
  const { data, error } = await supabase
    .from("alerts")
    .select("*")
    .order("triggered_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}
