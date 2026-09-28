import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { encrypt } from "@/lib/encryption";
import { PROVIDER_KEY_TYPE } from "@/lib/providers/registry";

const bodySchema = z.object({
  apiKey: z.string().min(1),
  name: z.string().min(1).default("default"),
  // Non-secret extra config a provider's key alone doesn't carry (e.g.
  // xAI's team_id) — see PROVIDER_CATALOG's extraConfigField.
  config: z.record(z.string(), z.string()).optional(),
});

// Stores (or rotates) a provider credential. The plaintext key is accepted
// here, encrypted immediately, and only the ciphertext is written to the
// database — the plaintext never touches a log or response body.
//
// provider_credentials has no RLS policy at all (service-role only, see
// CLAUDE.md), so unlike routes that write straight to `providers`, this one
// must explicitly verify project ownership itself before using the admin
// client — the regular client's lookup below is what fails closed for a
// project the caller doesn't own.
export async function POST(
  request: Request,
  context: RouteContext<"/api/projects/[projectId]/providers/[provider]/credentials">
) {
  const auth = await requireApiUser();
  if ("unauthorized" in auth) return auth.unauthorized;

  const { projectId, provider: slug } = await context.params;
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

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

  const keyType = PROVIDER_KEY_TYPE[slug] ?? "standard";
  const encryptedApiKey = encrypt(parsed.data.apiKey);
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("provider_credentials")
    .upsert(
      {
        provider_id: provider.id,
        key_type: keyType,
        name: parsed.data.name,
        encrypted_api_key: encryptedApiKey,
        config: parsed.data.config ?? null,
        status: "untested",
        last_tested_at: null,
      },
      { onConflict: "provider_id,key_type,name" }
    )
    .select("id, key_type, name, status")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ credential: data });
}
