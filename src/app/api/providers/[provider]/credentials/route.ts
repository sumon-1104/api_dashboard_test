import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { encrypt } from "@/lib/encryption";
import { PROVIDER_KEY_TYPE } from "@/lib/providers/registry";

const bodySchema = z.object({
  apiKey: z.string().min(1),
  name: z.string().min(1).default("default"),
});

// Stores (or rotates) a provider credential. The plaintext key is accepted
// here, encrypted immediately, and only the ciphertext is written to the
// database — the plaintext never touches a log or response body.
export async function POST(request: Request, context: RouteContext<"/api/providers/[provider]/credentials">) {
  const auth = await requireApiUser();
  if ("unauthorized" in auth) return auth.unauthorized;

  const { provider: slug } = await context.params;
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const keyType = PROVIDER_KEY_TYPE[slug] ?? "standard";
  const admin = createAdminClient();

  const { data: provider, error: providerError } = await admin
    .from("providers")
    .select("id")
    .eq("slug", slug)
    .single();
  if (providerError || !provider) {
    return NextResponse.json({ error: `Unknown provider "${slug}"` }, { status: 404 });
  }

  const encryptedApiKey = encrypt(parsed.data.apiKey);

  const { data, error } = await admin
    .from("provider_credentials")
    .upsert(
      {
        provider_id: provider.id,
        key_type: keyType,
        name: parsed.data.name,
        encrypted_api_key: encryptedApiKey,
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
