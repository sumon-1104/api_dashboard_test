import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

// Removes one project's stored credential. Historical usage/rate-limit rows
// are kept — credential_id is nullable with ON DELETE SET NULL, not cascade.
export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/providers/[provider]/credentials/[credentialId]">
) {
  const auth = await requireApiUser();
  if ("unauthorized" in auth) return auth.unauthorized;

  const { credentialId } = await context.params;
  const admin = createAdminClient();
  const { error } = await admin.from("provider_credentials").delete().eq("id", credentialId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
