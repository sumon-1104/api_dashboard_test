import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProviderClient } from "@/lib/providers/registry";
import { ProviderCredentialError } from "@/lib/providers/types";
import { resolveModelId } from "@/lib/usage/poll";

// Tests one specific credential ("project") rather than "the provider" —
// a provider can now have several projects, each with its own key.
export async function POST(
  _request: Request,
  context: RouteContext<"/api/providers/[provider]/credentials/[credentialId]/test">
) {
  const auth = await requireApiUser();
  if ("unauthorized" in auth) return auth.unauthorized;

  const { provider: slug, credentialId } = await context.params;
  const admin = createAdminClient();

  try {
    const { client } = await getProviderClient(slug, credentialId);
    const result = await client.testConnection();

    await admin
      .from("provider_credentials")
      .update({ status: result.ok ? "valid" : "invalid", last_tested_at: new Date().toISOString() })
      .eq("id", credentialId);

    const { data: provider } = await admin.from("providers").select("id").eq("slug", slug).single();
    if (provider) {
      await admin
        .from("providers")
        .update({ status: result.ok ? "connected" : "error" })
        .eq("id", provider.id);

      if (result.ok && result.usageSample) {
        const modelId = await resolveModelId(admin, provider.id, result.usageSample.modelName);
        await admin.from("usage_records").insert({
          provider_id: provider.id,
          credential_id: credentialId,
          model_id: modelId,
          source: "self_logged",
          input_tokens: result.usageSample.inputTokens,
          output_tokens: result.usageSample.outputTokens,
          cached_tokens: result.usageSample.cachedTokens,
          reasoning_tokens: result.usageSample.reasoningTokens,
          total_tokens: result.usageSample.totalTokens,
          metadata: result.usageSample.requestCount != null ? { requestCount: result.usageSample.requestCount } : null,
          status: "success",
        });
      }
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
