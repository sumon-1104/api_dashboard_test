import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

const updateSchema = z.object({
  limit_value: z.number().positive().optional(),
  period: z.enum(["daily", "monthly"]).optional(),
});

export async function PUT(request: Request, context: RouteContext<"/api/limits/[id]">) {
  const auth = await requireApiUser();
  if ("unauthorized" in auth) return auth.unauthorized;

  const { id } = await context.params;
  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from("usage_limits").update(parsed.data).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ limit: data });
}

export async function DELETE(_request: Request, context: RouteContext<"/api/limits/[id]">) {
  const auth = await requireApiUser();
  if ("unauthorized" in auth) return auth.unauthorized;

  const { id } = await context.params;
  const supabase = await createClient();
  const { error } = await supabase.from("usage_limits").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
