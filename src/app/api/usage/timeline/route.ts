import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getUsageTimeline } from "@/lib/usage/queries";

export async function GET(request: Request) {
  const auth = await requireApiUser();
  if ("unauthorized" in auth) return auth.unauthorized;

  const url = new URL(request.url);
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");
  const providerId = url.searchParams.get("providerId") ?? undefined;
  if (!start || !end) {
    return NextResponse.json({ error: "start and end query params (ISO dates) are required" }, { status: 400 });
  }

  const supabase = await createClient();
  const rows = await getUsageTimeline(supabase, { start: new Date(start), end: new Date(end) }, providerId);

  return NextResponse.json({ timeline: rows });
}
