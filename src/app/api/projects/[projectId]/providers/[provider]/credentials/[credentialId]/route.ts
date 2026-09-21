import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Removes one project's stored credential. Historical usage/rate-limit rows
// are kept — credential_id is nullable with ON DELETE SET NULL, not cascade.
// Same ownership note as the POST route: provider_credentials has no RLS of
// its own, so this route verifies via the regular client that the provider
// belongs to a project the caller owns before deleting with the admin client.
export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/projects/[projectId]/providers/[provider]/credentials/[credentialId]">
) {
  const auth = await requireApiUser();
  if ("unauthorized" in auth) return auth.unauthorized;

  const { projectId, provider: slug, credentialId } = await context.params;

  const supabase = await createClient();
  const { data: provider, error: providerError } = await supabase
    .from("providers")
    .select("id")
    .eq("project_id", projectId)
    .eq("slug", slug)
    .single();
  if (providerError || !provider) {
    return NextResponse.json({ error: `Provider "${slug}" not found in this project` }, { status: 404 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("provider_credentials")
    .delete()
    .eq("id", credentialId)
    .eq("provider_id", provider.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
