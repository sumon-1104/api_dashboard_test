import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const auth = await requireApiUser();
  if ("unauthorized" in auth) return auth.unauthorized;

  const supabase = await createClient();
  const { data, error } = await supabase.from("usage_limits").select("*").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ limits: data });
}

const createSchema = z.object({
  provider_id: z.string().uuid(),
  model_id: z.string().uuid().nullable().optional(),
  limit_type: z.enum(["monthly_tokens", "daily_tokens", "monthly_spend", "requests"]),
  limit_value: z.number().positive(),
  period: z.enum(["daily", "monthly"]),
});

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if ("unauthorized" in auth) return auth.unauthorized;

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from("usage_limits").insert(parsed.data).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ limit: data }, { status: 201 });
}
