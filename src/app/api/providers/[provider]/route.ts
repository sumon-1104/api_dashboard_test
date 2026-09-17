import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

const patchSchema = z.object({ enabled: z.boolean() });

// Enable/disable a provider. Uses the admin client only to bypass nothing
// sensitive here — providers has no secret columns — but keeps a single
// consistent write path alongside the credentials route.
export async function PATCH(request: Request, context: RouteContext<"/api/providers/[provider]">) {
  const auth = await requireApiUser();
  if ("unauthorized" in auth) return auth.unauthorized;

  const { provider: slug } = await context.params;
  const body = patchSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.message }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("providers")
    .update({ enabled: body.data.enabled })
    .eq("slug", slug)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ provider: data });
}
