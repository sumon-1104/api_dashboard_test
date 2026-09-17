import { Badge } from "@/components/ui/badge";
import type { ProviderStatus as Status } from "@/types/database";

const VARIANTS: Record<Status, { label: string; className: string }> = {
  connected: { label: "Connected", className: "bg-emerald-600 text-white" },
  disconnected: { label: "Disconnected", className: "bg-muted text-muted-foreground" },
  error: { label: "Error", className: "bg-destructive text-white" },
};

export function ProviderStatus({ status }: { status: Status }) {
  const variant = VARIANTS[status];
  return <Badge className={variant.className}>{variant.label}</Badge>;
}
