import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

// Both fields optional, but at least one must be present — this route
// handles both the enable/disable toggle and renaming the display name, so a
// caller might send either independently.
const patchSchema = z
  .object({ enabled: z.boolean().optional(), name: z.string().min(1).optional() })
  .refine((body) => body.enabled !== undefined || body.name !== undefined, {
    message: "Provide at least one of enabled or name",
  });

// Enable/disable one provider within a project, and/or rename its display
// name (the slug/integration itself never changes — only the label). RLS
// scopes this update to providers whose project the caller owns.
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

  const update: { enabled?: boolean; name?: string } = {};
  if (body.data.enabled !== undefined) update.enabled = body.data.enabled;
  if (body.data.name !== undefined) update.name = body.data.name;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("providers")
    .update(update)
    .eq("project_id", projectId)
    .eq("slug", slug)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ provider: data });
}

// Removing a provider cascades (see supabase/migrations/0001_init.sql) to
// delete every credential, usage record, model, rate limit, error, and alert
// hung off it — unlike removing a single credential, which keeps history.
// RLS scopes this to providers whose project the caller owns.
export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/projects/[projectId]/providers/[provider]">
) {
  const auth = await requireApiUser();
  if ("unauthorized" in auth) return auth.unauthorized;

  const { projectId, provider: slug } = await context.params;
  const supabase = await createClient();
  const { error } = await supabase.from("providers").delete().eq("project_id", projectId).eq("slug", slug);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
