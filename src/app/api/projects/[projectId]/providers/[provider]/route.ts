import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

const patchSchema = z.object({ enabled: z.boolean() });

// Enable/disable one provider within a project. RLS scopes this update to
// providers whose project the caller owns.
export async function PATCH(
  request: Request,
  context: RouteContext<"/api/projects/[projectId]/providers/[provider]">
) {
  const auth = await requireApiUser();
  if ("unauthorized" in auth) return auth.unauthorized;

  const { projectId, provider: slug } = await context.params;
  const body = patchSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.message }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("providers")
    .update({ enabled: body.data.enabled })
    .eq("project_id", projectId)
    .eq("slug", slug)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ provider: data });
}
