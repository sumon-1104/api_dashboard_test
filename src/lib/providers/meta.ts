// Client-safe display metadata — no "server-only" import here.

export interface ProviderDisplayMeta {
  shortLabel: string;
  adminKeyHelp: string;
}

export const PROVIDER_DISPLAY_META: Record<string, ProviderDisplayMeta> = {
  openai: {
    shortLabel: "OpenAI",
    adminKeyHelp: "Organization Settings → Admin Keys (platform.openai.com/settings/organization/admin-keys)",
  },
  anthropic: {
    shortLabel: "Anthropic",
    adminKeyHelp: "Console → Settings → Admin API Keys (sk-ant-admin01-...) or an org:admin OAuth token",
  },
  gemini: {
    shortLabel: "Gemini",
    adminKeyHelp: "Google AI Studio API key — used only for a connection test; no usage API exists to poll",
  },
};
