import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { maskApiKey, decrypt } from "@/lib/encryption";
import { ProviderCard, type ProviderWithCredentials } from "@/components/providers/provider-card";
import { AddProviderForm } from "@/components/projects/add-provider-form";

export default async function ProjectDetailPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const supabase = await createClient();

  // RLS scopes this to the caller's own projects — a project the caller
  // doesn't own resolves to no row here, same as a genuinely missing id.
  const { data: project } = await supabase.from("projects").select("*").eq("id", projectId).single();
  if (!project) notFound();

  const { data: providers } = await supabase
    .from("providers")
    .select("*")
    .eq("project_id", projectId)
    .order("name");

  const admin = createAdminClient();
  const { data: credentials } = await admin
    .from("provider_credentials")
    .select("id, provider_id, key_type, name, encrypted_api_key, status, last_tested_at")
    .in("provider_id", (providers ?? []).map((p) => p.id));

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
        <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
        <p className="text-sm text-muted-foreground">
          Add providers to this project, then connect one or more API keys for each.
        </p>
      </div>

      <AddProviderForm projectId={project.id} existingSlugs={(providers ?? []).map((p) => p.slug)} />

      {providersWithCredentials.length === 0 ? (
        <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          No providers added yet — use the form above to add one.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {providersWithCredentials.map((provider) => (
            <ProviderCard key={provider.id} provider={provider} projectId={project.id} />
          ))}
        </div>
      )}
    </div>
  );
}
