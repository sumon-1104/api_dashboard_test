import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getRecentErrors } from "@/lib/usage/queries";

export async function GET(request: Request) {
  const auth = await requireApiUser();
  if ("unauthorized" in auth) return auth.unauthorized;

  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page") ?? "1");
  const pageSize = Math.min(Number(url.searchParams.get("pageSize") ?? "25"), 100);
  const providerId = url.searchParams.get("providerId") ?? undefined;

  const supabase = await createClient();
  const result = await getRecentErrors(supabase, { page, pageSize, providerId });

  return NextResponse.json(result);
}
