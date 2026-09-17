import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

const patchSchema = z.object({
  enabled: z.boolean().optional(),
  input_price_per_million: z.number().nonnegative().nullable().optional(),
  output_price_per_million: z.number().nonnegative().nullable().optional(),
});

export async function PATCH(request: Request, context: RouteContext<"/api/models/[id]">) {
  const auth = await requireApiUser();
  if ("unauthorized" in auth) return auth.unauthorized;

  const { id } = await context.params;
  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from("models").update(parsed.data).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ model: data });
}
