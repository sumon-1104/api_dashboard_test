import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const auth = await requireApiUser();
  if ("unauthorized" in auth) return auth.unauthorized;

  const supabase = await createClient();
  const { data, error } = await supabase.from("models").select("*").order("display_name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ models: data });
}
