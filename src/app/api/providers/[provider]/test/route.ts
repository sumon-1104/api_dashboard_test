import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProviderClient, PROVIDER_KEY_TYPE } from "@/lib/providers/registry";
import { ProviderCredentialError } from "@/lib/providers/types";

export async function POST(_request: Request, context: RouteContext<"/api/providers/[provider]/test">) {
  const auth = await requireApiUser();
  if ("unauthorized" in auth) return auth.unauthorized;

  const { provider: slug } = await context.params;
  const admin = createAdminClient();

  try {
    const client = await getProviderClient(slug);
    const result = await client.testConnection();

    const { data: provider } = await admin.from("providers").select("id").eq("slug", slug).single();
    if (provider) {
      await admin
        .from("provider_credentials")
        .update({ status: result.ok ? "valid" : "invalid", last_tested_at: new Date().toISOString() })
        .eq("provider_id", provider.id)
        .eq("key_type", PROVIDER_KEY_TYPE[slug] ?? "standard");

      await admin
        .from("providers")
        .update({ status: result.ok ? "connected" : "error" })
        .eq("id", provider.id);
    }

    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (err) {
    if (err instanceof ProviderCredentialError) {
      return NextResponse.json({ ok: false, message: err.message }, { status: 400 });
    }
    return NextResponse.json(
      { ok: false, message: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
