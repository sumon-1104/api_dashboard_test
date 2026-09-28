import { Badge } from "@/components/ui/badge";
import type { ProviderStatus as Status } from "@/types/database";

const VARIANTS: Record<Status, { label: string; className: string }> = {
  connected: { label: "Connected", className: "bg-emerald-600 text-white" },
  disconnected: { label: "Disconnected", className: "bg-muted text-muted-foreground" },
  error: { label: "Error", className: "bg-destructive text-white" },
};

// `status` only records the result of the last connection test/poll — it
// doesn't know whether the provider is currently enabled. A disabled
// provider that was successfully tested before being turned off would
// otherwise still show a green "Connected" badge, which visibly contradicts
// counts elsewhere (e.g. Overview's "Active Providers") that correctly
// require enabled AND connected. Passing `enabled={false}` overrides the
// status-derived badge so the two never disagree.
export function ProviderStatus({ status, enabled = true }: { status: Status; enabled?: boolean }) {
  if (!enabled) {
    return <Badge className="bg-muted text-muted-foreground">Disabled</Badge>;
  }
  const variant = VARIANTS[status];
  return <Badge className={variant.className}>{variant.label}</Badge>;
}
