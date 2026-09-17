// Seeds only the three v1 providers. Deliberately does NOT seed any model
// rows: model identifiers and pricing change too often to hardcode honestly,
// and third-party "pricing" pages are not a trustworthy source for a
// dashboard whose entire premise is "never fabricate a number." Instead,
// models are discovered automatically the first time real usage data is
// polled (see lib/usage/poll.ts), with pricing left null until an admin sets
// it on the Models page from the provider's own pricing page.
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (see .env.local).");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const PROVIDERS = [
  { name: "OpenAI", slug: "openai", provider_kind: "llm" },
  { name: "Gemini", slug: "gemini", provider_kind: "llm" },
  { name: "Anthropic", slug: "anthropic", provider_kind: "llm" },
];

async function main() {
  const { error } = await supabase.from("providers").upsert(PROVIDERS, { onConflict: "slug" });
  if (error) {
    console.error("Failed to seed providers:", error.message);
    process.exit(1);
  }
  console.log(`Seeded ${PROVIDERS.length} providers: ${PROVIDERS.map((p) => p.slug).join(", ")}`);
}

main();
