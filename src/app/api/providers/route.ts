import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { maskApiKey, decrypt } from "@/lib/encryption";

// Returns providers with a masked view of their stored credentials. The
// encrypted key itself is decrypted only long enough, server-side, to mask
// it for display — it is never sent to the client in full or in cipher form.
export async function GET() {
  const auth = await requireApiUser();
  if ("unauthorized" in auth) return auth.unauthorized;

  const supabase = await createClient();
  const { data: providers, error } = await supabase.from("providers").select("*").order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const admin = createAdminClient();
  const { data: credentials } = await admin
    .from("provider_credentials")
    .select("id, provider_id, key_type, name, encrypted_api_key, status, last_tested_at, created_at");

  const result = providers.map((provider) => {
    const creds = (credentials ?? [])
      .filter((c) => c.provider_id === provider.id)
      .map((c) => {
        let masked = "••••••••";
        try {
          masked = maskApiKey(decrypt(c.encrypted_api_key));
        } catch {
          // leave masked placeholder if decryption fails (e.g. key rotated)
        }
        return {
          id: c.id,
          keyType: c.key_type,
          name: c.name,
          maskedKey: masked,
          status: c.status,
          lastTestedAt: c.last_tested_at,
        };
      });

    return { ...provider, credentials: creds };
  });

  return NextResponse.json({ providers: result });
}
