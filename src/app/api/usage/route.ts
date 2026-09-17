import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

// Paginated raw usage_records — used for drill-down, not for dashboard
// aggregates (those go through /api/usage/summary and /api/usage/timeline,
// which aggregate in Postgres).
export async function GET(request: Request) {
  const auth = await requireApiUser();
  if ("unauthorized" in auth) return auth.unauthorized;

  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page") ?? "1");
  const pageSize = Math.min(Number(url.searchParams.get("pageSize") ?? "50"), 200);
  const providerId = url.searchParams.get("providerId");
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const supabase = await createClient();
  let query = supabase
    .from("usage_records")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (providerId) query = query.eq("provider_id", providerId);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ records: data, count: count ?? 0, page, pageSize });
}
