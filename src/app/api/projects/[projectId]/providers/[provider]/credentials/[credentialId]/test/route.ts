import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProviderClient } from "@/lib/providers/registry";
import { ProviderCredentialError } from "@/lib/providers/types";
import { ProviderHttpError } from "@/lib/providers/http";
import { resolveModelId } from "@/lib/usage/poll";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// Gemini's ping alone can take ~20s, longer than Vercel Hobby's 10s default.
export const maxDuration = 60;

async function logConnectionFailure(
  admin: SupabaseClient<Database>,
  providerId: string,
  message: string,
  statusCode: number | null
) {
  await admin.from("api_errors").insert({
    provider_id: providerId,
    status_code: statusCode,
    error_code: "connection_failed",
    message,
  });
}

// Tests one specific credential under one specific provider row. Verifies
// project ownership via the regular client first (same reasoning as the
// sibling credentials routes), then uses the admin client to decrypt the key
// and write test results.
export async function POST(
  _request: Request,
  context: RouteContext<"/api/projects/[projectId]/providers/[provider]/credentials/[credentialId]/test">
) {
  const auth = await requireApiUser();
  if ("unauthorized" in auth) return auth.unauthorized;

  const { projectId, provider: slug, credentialId } = await context.params;

  const supabase = await createClient();
  const { data: provider, error: providerError } = await supabase
    .from("providers")
    .select("id, name")
    .eq("project_id", projectId)
    .eq("slug", slug)
    .single();
  if (providerError || !provider) {
    return NextResponse.json({ error: `Provider "${slug}" not found in this project` }, { status: 404 });
  }

  const admin = createAdminClient();

  try {
    const { client } = await getProviderClient(provider.id, slug, credentialId);
    const result = await client.testConnection();

    await admin
      .from("provider_credentials")
      .update({ status: result.ok ? "valid" : "invalid", last_tested_at: new Date().toISOString() })
      .eq("id", credentialId);

    await admin
      .from("providers")
      .update({ status: result.ok ? "connected" : "error" })
      .eq("id", provider.id);

    if (!result.ok) {
      await logConnectionFailure(admin, provider.id, result.message, null);
    }

    if (result.ok && result.usageSample) {
      const modelId = await resolveModelId(admin, provider.id, result.usageSample.modelName);
      const { error: insertError } = await admin.from("usage_records").insert({
        provider_id: provider.id,
        credential_id: credentialId,
        model_id: modelId,
        source: "self_logged",
        input_tokens: result.usageSample.inputTokens,
        output_tokens: result.usageSample.outputTokens,
        cached_tokens: result.usageSample.cachedTokens,
        reasoning_tokens: result.usageSample.reasoningTokens,
        total_tokens: result.usageSample.totalTokens,
        estimated_cost: result.costUsdSample ?? null,
        metadata: result.usageSample.requestCount != null ? { requestCount: result.usageSample.requestCount } : null,
        status: "success",
      });
      // A successful provider ping must not be reported as a successful
      // Test Connection if the usage sample it captured couldn't actually
      // be saved — that would silently discard real data while claiming
      // success (this exact failure mode went undetected all session: a
      // missing DB column made every self-logged insert fail silently).
      if (insertError) {
        await logConnectionFailure(
          admin,
          provider.id,
          `Connected, but failed to save the usage sample: ${insertError.message}`,
          null
        );
      }
    }

    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const statusCode = err instanceof ProviderHttpError ? (err.status ?? null) : null;
    await logConnectionFailure(admin, provider.id, message, statusCode);
    await admin.from("providers").update({ status: "error" }).eq("id", provider.id);

    if (err instanceof ProviderCredentialError) {
      return NextResponse.json({ ok: false, message: err.message }, { status: 400 });
    }
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
