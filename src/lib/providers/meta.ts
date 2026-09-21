// Client-safe display metadata — no "server-only" import here.

export interface ProviderCatalogEntry {
  slug: string;
  name: string;
  kind: "llm" | "search";
  // Has a real AIProvider class wired up in lib/providers/registry.ts. An
  // unsupported (or custom) entry still gets a providers row + credential
  // storage, but Test Connection and polling stay unavailable until a real
  // integration is written for it — never fabricate what it would report.
  supported: boolean;
  adminKeyHelp?: string;
}

export const PROVIDER_CATALOG: ProviderCatalogEntry[] = [
  {
    slug: "openai",
    name: "OpenAI",
    kind: "llm",
    supported: true,
    adminKeyHelp: "Organization Settings → Admin Keys (platform.openai.com/settings/organization/admin-keys)",
  },
  {
    slug: "anthropic",
    name: "Anthropic",
    kind: "llm",
    supported: true,
    adminKeyHelp: "Console → Settings → Admin API Keys (sk-ant-admin01-...) or an org:admin OAuth token",
  },
  {
    slug: "gemini",
    name: "Google Gemini",
    kind: "llm",
    supported: true,
    adminKeyHelp: "Google AI Studio API key — used only for a connection test; no usage API exists to poll",
  },
  { slug: "tavily", name: "Tavily", kind: "search", supported: false },
  { slug: "xai", name: "xAI", kind: "llm", supported: false },
  { slug: "deepseek", name: "DeepSeek", kind: "llm", supported: false },
  { slug: "mistral", name: "Mistral", kind: "llm", supported: false },
  { slug: "perplexity", name: "Perplexity", kind: "llm", supported: false },
];

export const PROVIDER_DISPLAY_META: Record<string, ProviderCatalogEntry> = Object.fromEntries(
  PROVIDER_CATALOG.map((p) => [p.slug, p])
);
