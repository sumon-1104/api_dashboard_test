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

/**
 * Loads the provider's row + its decrypted credential and returns a ready
 * AIProvider instance. Always goes through the service-role client — this is
 * the only place `provider_credentials.encrypted_api_key` is ever read.
 */
export async function getProviderClient(slug: string): Promise<AIProvider> {
  const factory = PROVIDER_FACTORIES[slug];
  if (!factory) {
    throw new ProviderCredentialError(`No provider client registered for slug "${slug}"`);
  }

  const admin = createAdminClient();
  const { data: provider, error: providerError } = await admin
    .from("providers")
    .select("id")
    .eq("slug", slug)
    .single();

  if (providerError || !provider) {
    throw new ProviderCredentialError(`Provider "${slug}" is not configured`);
  }

  const keyType = PROVIDER_KEY_TYPE[slug] ?? "standard";
  const { data: credential, error: credentialError } = await admin
    .from("provider_credentials")
    .select("encrypted_api_key")
    .eq("provider_id", provider.id)
    .eq("key_type", keyType)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (credentialError || !credential) {
    throw new ProviderCredentialError(
      `No "${keyType}" credential stored for "${slug}". Add one on the Providers page.`
    );
  }

  const apiKey = decrypt(credential.encrypted_api_key);
  return factory(apiKey);
}

export function listSupportedProviderSlugs(): string[] {
  return Object.keys(PROVIDER_FACTORIES);
}
