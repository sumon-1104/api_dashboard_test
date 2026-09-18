import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getProviderClient, listProviderCredentials } from "@/lib/providers/registry";
import { ProviderCredentialError } from "@/lib/providers/types";

type AdminClient = SupabaseClient<Database>;

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export async function resolveModelId(admin: AdminClient, providerId: string, modelName: string | null): Promise<string | null> {
  if (!modelName) return null;

  const { data: existing } = await admin
    .from("models")
    .select("id")
    .eq("provider_id", providerId)
    .eq("model_name", modelName)
    .maybeSingle();
  if (existing) return existing.id;

  // Discovered from real usage data — pricing stays null until an admin sets
  // it on the Models page. Never guess a price.
  const { data: created, error } = await admin
    .from("models")
    .insert({
      provider_id: providerId,
      model_name: modelName,
      display_name: modelName,
      input_price_per_million: null,
      output_price_per_million: null,
      enabled: true,
    })
    .select("id")
    .single();

  if (error || !created) return null;
  return created.id;
}

export interface PollResult {
  slug: string;
  polled: boolean;
  modelsSeen: number;
  totalCostUsd: number | null;
  message?: string;
}

/**
 * Polls every credential ("project") stored for a provider, independently,
 * for "today" (UTC), replacing each project's own today's provider_polled
 * rows. Re-running later the same day simply overwrites that project's
 * snapshot with its latest cumulative total — this is what makes the poll
 * idempotent without a unique-constraint dance. Projects are scoped by
 * credential_id so polling one never clobbers another's same-day rows.
 */
export async function pollProvider(admin: AdminClient, slug: string): Promise<PollResult> {
  const { data: provider } = await admin.from("providers").select("id, enabled").eq("slug", slug).single();
  if (!provider) {
    return { slug, polled: false, modelsSeen: 0, totalCostUsd: null, message: "Provider not configured" };
  }
  if (!provider.enabled) {
    return { slug, polled: false, modelsSeen: 0, totalCostUsd: null, message: "Provider disabled" };
  }

  const credentials = await listProviderCredentials(slug);
  if (credentials.length === 0) {
    return {
      slug,
      polled: false,
      modelsSeen: 0,
      totalCostUsd: null,
      message: `No credential stored for "${slug}". Add one on the Providers page.`,
    };
  }

  const now = new Date();
  const start = startOfUtcDay(now);
  const range = { start, end: now };

  let modelsSeen = 0;
  let anyCostKnown = false;
  let totalCostUsd = 0;
  const failures: string[] = [];

  for (const credential of credentials) {
    let loaded;
    try {
      loaded = await getProviderClient(slug, credential.id);
    } catch (err) {
      failures.push(err instanceof ProviderCredentialError ? err.message : `Failed to load "${credential.name}"`);
      continue;
    }
    const { client, credentialId } = loaded;

    const [usage, cost] = await Promise.all([client.getUsage(range), client.getCost(range)]);

    // Clear today's snapshot for this project before writing the fresh one.
    await admin
      .from("usage_records")
      .delete()
      .eq("provider_id", provider.id)
      .eq("credential_id", credentialId)
      .eq("source", "provider_polled")
      .gte("created_at", start.toISOString());

    const rows: Database["public"]["Tables"]["usage_records"]["Insert"][] = [];

    if (usage?.tokenBuckets) {
      for (const bucket of usage.tokenBuckets) {
        const modelId = await resolveModelId(admin, provider.id, bucket.modelName);
        rows.push({
          provider_id: provider.id,
          credential_id: credentialId,
          model_id: modelId,
          source: "provider_polled",
          request_id: `${slug}:${credentialId}:${start.toISOString().slice(0, 10)}:${bucket.modelName ?? "unknown"}`,
          input_tokens: bucket.inputTokens,
          output_tokens: bucket.outputTokens,
          cached_tokens: bucket.cachedTokens,
          reasoning_tokens: bucket.reasoningTokens,
          total_tokens: bucket.totalTokens,
          metadata: bucket.requestCount != null ? { requestCount: bucket.requestCount } : null,
          status: "success",
        });
        modelsSeen += 1;
      }
    }

    if (cost) {
      rows.push({
        provider_id: provider.id,
        credential_id: credentialId,
        model_id: null,
        source: "provider_polled",
        request_id: `${slug}:${credentialId}:${start.toISOString().slice(0, 10)}:cost`,
        estimated_cost: cost.totalCostUsd,
        status: "success",
      });
      anyCostKnown = true;
      totalCostUsd += cost.totalCostUsd;
    }

    if (rows.length > 0) {
      await admin.from("usage_records").insert(rows);
    }

    // Rate limits (Anthropic only, today): full refresh per project — see CLAUDE.md.
    const rateLimits = await client.getRateLimits();
    await admin
      .from("rate_limits")
      .delete()
      .eq("provider_id", provider.id)
      .eq("credential_id", credentialId)
      .eq("source", "provider_reported");
    if (rateLimits && rateLimits.length > 0) {
      await admin.from("rate_limits").insert(
        rateLimits.map((rl) => ({
          provider_id: provider.id,
          credential_id: credentialId,
          model_id: null,
          limit_type: rl.limitType,
          current_usage: rl.currentUsage,
          limit_value: rl.limitValue,
          reset_at: rl.resetAt?.toISOString() ?? null,
          source: rl.source,
        }))
      );
    }
  }

  await admin.from("providers").update({ status: "connected" }).eq("id", provider.id);

  return {
    slug,
    polled: true,
    modelsSeen,
    totalCostUsd: anyCostKnown ? totalCostUsd : null,
    message: failures.length > 0 ? failures.join("; ") : undefined,
  };
}
