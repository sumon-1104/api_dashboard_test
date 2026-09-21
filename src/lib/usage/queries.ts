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

// projectId/providerId here are a UX narrowing filter layered on top of RLS,
// not a security boundary — RLS already guarantees a caller only ever sees
// their own rows regardless of these params (see CLAUDE.md § Database rules).
export interface UsageFilter {
  projectId?: string;
  providerId?: string;
}

export async function getProjects(supabase: Client) {
  const { data, error } = await supabase.from("projects").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getProviders(supabase: Client, projectId?: string) {
  let query = supabase.from("providers").select("*").order("name");
  if (projectId) query = query.eq("project_id", projectId);
  const { data, error } = await query;
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
  range: { start: Date; end: Date },
  filter: UsageFilter = {}
): Promise<UsageSummaryRow[]> {
  const { data, error } = await supabase.rpc("usage_summary_by_provider", {
    p_start: range.start.toISOString(),
    p_end: range.end.toISOString(),
    p_project_id: filter.projectId ?? null,
    p_provider_id: filter.providerId ?? null,
  });
  if (error) throw error;
  return (data ?? []) as UsageSummaryRow[];
}

export async function getUsageTimeline(
  supabase: Client,
  range: { start: Date; end: Date },
  filter: UsageFilter = {}
): Promise<UsageTimelineRow[]> {
  const { data, error } = await supabase.rpc("usage_timeline", {
    p_start: range.start.toISOString(),
    p_end: range.end.toISOString(),
    p_project_id: filter.projectId ?? null,
    p_provider_id: filter.providerId ?? null,
  });
  if (error) throw error;
  return (data ?? []) as UsageTimelineRow[];
}

export async function getUsageByModel(
  supabase: Client,
  range: { start: Date; end: Date },
  filter: UsageFilter = {}
): Promise<UsageByModelRow[]> {
  const { data, error } = await supabase.rpc("usage_by_model", {
    p_start: range.start.toISOString(),
    p_end: range.end.toISOString(),
    p_project_id: filter.projectId ?? null,
    p_provider_id: filter.providerId ?? null,
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
  opts: { page?: number; pageSize?: number; providerId?: string; providerIds?: string[] } = {}
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
  else if (opts.providerIds) query = query.in("provider_id", opts.providerIds);

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
