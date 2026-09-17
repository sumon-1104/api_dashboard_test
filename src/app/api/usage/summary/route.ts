import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getUsageSummaryByProvider } from "@/lib/usage/queries";

export async function GET(request: Request) {
  const auth = await requireApiUser();
  if ("unauthorized" in auth) return auth.unauthorized;

  const url = new URL(request.url);
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");
  if (!start || !end) {
    return NextResponse.json({ error: "start and end query params (ISO dates) are required" }, { status: 400 });
  }

  const supabase = await createClient();
  const rows = await getUsageSummaryByProvider(supabase, { start: new Date(start), end: new Date(end) });

  const totals = rows.reduce(
    (acc, r) => ({
      inputTokens: acc.inputTokens + Number(r.input_tokens),
      outputTokens: acc.outputTokens + Number(r.output_tokens),
      totalTokens: acc.totalTokens + Number(r.total_tokens),
      estimatedCost: acc.estimatedCost + Number(r.estimated_cost),
      requestCount: acc.requestCount + Number(r.request_count),
    }),
    { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCost: 0, requestCount: 0 }
  );

  return NextResponse.json({ totals, byProvider: rows });
}
