import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { maskApiKey, decrypt } from "@/lib/encryption";
import { ProviderCard, type ProviderWithCredentials } from "@/components/providers/provider-card";

export default async function ProvidersPage() {
  const supabase = await createClient();
  const { data: providers } = await supabase.from("providers").select("*").order("name");

  const admin = createAdminClient();
  const { data: credentials } = await admin
    .from("provider_credentials")
    .select("id, provider_id, key_type, name, encrypted_api_key, status, last_tested_at");

  const providersWithCredentials: ProviderWithCredentials[] = (providers ?? []).map((provider) => ({
    ...provider,
    credentials: (credentials ?? [])
      .filter((c) => c.provider_id === provider.id)
      .map((c) => {
        let maskedKey = "••••••••";
        try {
          maskedKey = maskApiKey(decrypt(c.encrypted_api_key));
        } catch {
          // stored payload from a rotated ENCRYPTION_KEY — show placeholder, not an error
        }
        return {
          id: c.id,
          keyType: c.key_type,
          name: c.name,
          maskedKey,
          status: c.status,
          lastTestedAt: c.last_tested_at,
        };
      }),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Providers</h1>
        <p className="text-sm text-muted-foreground">
          Connect Admin/API keys and verify each provider before polling begins.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {providersWithCredentials.map((provider) => (
          <ProviderCard key={provider.id} provider={provider} />
        ))}
      </div>
    </div>
  );
}
