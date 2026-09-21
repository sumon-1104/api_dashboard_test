import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/encryption";
import type { CredentialKeyType } from "@/types/database";
import { OpenAIProvider } from "./openai";
import { AnthropicProvider } from "./anthropic";
import { GeminiProvider } from "./gemini";
import { ProviderCredentialError, type AIProvider } from "./types";

// The credential this provider needs to poll usage/cost. Document the
// convention here as each new provider is added (see CLAUDE.md):
//   'standard' — Tavily, DeepSeek (reuse the same key used for normal calls)
//   'admin'    — OpenAI, Anthropic, Mistral (org-level admin key)
//   'management' — xAI (separate management-scoped key)
export const PROVIDER_KEY_TYPE: Record<string, CredentialKeyType> = {
  openai: "admin",
  anthropic: "admin",
  gemini: "standard",
};

const PROVIDER_FACTORIES: Record<string, (key: string) => AIProvider> = {
  openai: (key) => new OpenAIProvider(key),
  anthropic: (key) => new AnthropicProvider(key),
  gemini: (key) => new GeminiProvider(key),
};

export interface LoadedProviderClient {
  client: AIProvider;
  credentialId: string;
}

/**
 * Lists every stored credential ("key") for a specific provider row's key
 * type, oldest first. A provider can have multiple — each is a separate
 * account under the same platform (e.g. two OpenAI orgs), polled
 * independently. Takes `providerId` directly rather than resolving a slug —
 * a slug is no longer globally unique once providers are project-scoped, so
 * callers must already know which provider row they mean.
 */
export async function listProviderCredentials(
  providerId: string,
  slug: string
): Promise<{ id: string; name: string }[]> {
  const admin = createAdminClient();
  const keyType = PROVIDER_KEY_TYPE[slug] ?? "standard";
  const { data: credentials } = await admin
    .from("provider_credentials")
    .select("id, name")
    .eq("provider_id", providerId)
    .eq("key_type", keyType)
    .order("created_at", { ascending: true });

  return credentials ?? [];
}

/**
 * Loads one specific credential's decrypted key and returns a ready
 * AIProvider instance for it. Always goes through the service-role client —
 * this is the only place `provider_credentials.encrypted_api_key` is ever
 * read. Without `credentialId`, falls back to the most recently added
 * credential for this provider row.
 */
export async function getProviderClient(
  providerId: string,
  slug: string,
  credentialId?: string
): Promise<LoadedProviderClient> {
  const factory = PROVIDER_FACTORIES[slug];
  if (!factory) {
    throw new ProviderCredentialError(`No provider client registered for slug "${slug}"`);
  }

  const admin = createAdminClient();
  const keyType = PROVIDER_KEY_TYPE[slug] ?? "standard";
  let query = admin
    .from("provider_credentials")
    .select("id, encrypted_api_key")
    .eq("provider_id", providerId)
    .eq("key_type", keyType);

  query = credentialId
    ? query.eq("id", credentialId)
    : query.order("created_at", { ascending: false }).limit(1);

  const { data: credential, error: credentialError } = await query.maybeSingle();

  if (credentialError || !credential) {
    throw new ProviderCredentialError(
      `No "${keyType}" credential stored for "${slug}". Add one on this project's page.`
    );
  }

  const apiKey = decrypt(credential.encrypted_api_key);
  return { client: factory(apiKey), credentialId: credential.id };
}

export function listSupportedProviderSlugs(): string[] {
  return Object.keys(PROVIDER_FACTORIES);
}
