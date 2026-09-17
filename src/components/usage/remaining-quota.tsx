import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { WARNING_THRESHOLD_PCT, type RemainingQuota as RemainingQuotaValue } from "@/lib/usage/remaining";

const SOURCE_LABEL: Record<RemainingQuotaValue["source"], string> = {
  provider: "Source: Provider",
  application_calculated: "Source: Application calculated",
  unknown: "Unknown",
};

const SOURCE_VARIANT: Record<RemainingQuotaValue["source"], "default" | "secondary" | "outline"> = {
  provider: "default",
  application_calculated: "secondary",
  unknown: "outline",
};

/** Renders all three remaining-quota states distinctly — never blends them. */
export function RemainingQuota({ quota, unit = "" }: { quota: RemainingQuotaValue; unit?: string }) {
  if (quota.source === "unknown") {
    return (
      <div className="space-y-1">
        <p className="text-sm font-medium text-muted-foreground">Remaining: Not available</p>
        <p className="text-xs text-muted-foreground">
          This provider does not expose an exact remaining quota through its API.
        </p>
      </div>
    );
  }

  const pct = quota.percentUsed != null ? Math.min(100, Math.max(0, quota.percentUsed)) : null;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">
          {quota.remaining?.toLocaleString()} {unit} remaining
        </span>
        <Badge variant={SOURCE_VARIANT[quota.source]}>{SOURCE_LABEL[quota.source]}</Badge>
      </div>
      {pct != null && <Progress value={pct} />}
      <p className="text-xs text-muted-foreground">
        {quota.used?.toLocaleString()} / {quota.limit?.toLocaleString()} {unit} used
        {pct != null ? ` (${pct.toFixed(1)}%)` : ""}
      </p>
      {pct != null && pct >= WARNING_THRESHOLD_PCT && (
        <p className="text-xs font-medium text-amber-600 dark:text-amber-500">
          ⚠ Approaching limit ({WARNING_THRESHOLD_PCT}% warning threshold)
        </p>
      )}
    </div>
  );
}
