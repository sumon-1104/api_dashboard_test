import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { maskApiKey, decrypt } from "@/lib/encryption";
import { PROVIDER_DISPLAY_META } from "@/lib/providers/meta";

// Lists providers under one project, each with a masked view of its stored
// credentials. The regular (RLS-scoped) client is used for `providers` — a
// project the caller doesn't own simply returns no rows, enforced by the DB
// itself, not just this route's logic. Only the encrypted key column needs
// the service-role client, and only long enough to mask it for display.
export async function GET(_request: Request, context: RouteContext<"/api/projects/[projectId]/providers">) {
  const auth = await requireApiUser();
  if ("unauthorized" in auth) return auth.unauthorized;

  const { projectId } = await context.params;
  const supabase = await createClient();
  const { data: providers, error } = await supabase
    .from("providers")
    .select("*")
    .eq("project_id", projectId)
    .order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const admin = createAdminClient();
  const { data: credentials } = await admin
    .from("provider_credentials")
    .select("id, provider_id, key_type, name, encrypted_api_key, status, last_tested_at")
    .in("provider_id", providers.map((p) => p.id));

  const result = providers.map((provider) => {
    const creds = (credentials ?? [])
      .filter((c) => c.provider_id === provider.id)
      .map((c) => {
        let masked = "••••••••";
        try {
          masked = maskApiKey(decrypt(c.encrypted_api_key));
        } catch {
          // stored payload from a rotated ENCRYPTION_KEY — show placeholder, not an error
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

const slugPattern = /^[a-z0-9][a-z0-9-]{0,63}$/;

const createSchema = z.object({
  slug: z.string().regex(slugPattern, "Use lowercase letters, numbers, and hyphens only"),
  name: z.string().min(1),
});

// Adds a provider (from the catalog, or a free-typed custom slug) to a
// project. RLS on `providers` requires the project to belong to the caller,
// so this insert fails closed for a project the user doesn't own.
export async function POST(request: Request, context: RouteContext<"/api/projects/[projectId]/providers">) {
  const auth = await requireApiUser();
  if ("unauthorized" in auth) return auth.unauthorized;

  const { projectId } = await context.params;
  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const catalogEntry = PROVIDER_DISPLAY_META[parsed.data.slug];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("providers")
    .insert({
      project_id: projectId,
      slug: parsed.data.slug,
      name: parsed.data.name,
      provider_kind: catalogEntry?.kind ?? "llm",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ provider: data }, { status: 201 });
}
