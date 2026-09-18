import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProviderStatus } from "@/components/providers/provider-status";
import { RemainingQuota } from "@/components/usage/remaining-quota";
import { formatUsd, type CostSource } from "@/lib/costs";
import type { Provider } from "@/types/database";
import type { RemainingQuota as RemainingQuotaValue } from "@/lib/usage/remaining";

const COST_SOURCE_LABEL: Partial<Record<CostSource, string>> = {
  provider_reported: "Source: Provider",
  application_calculated: "Source: Calculated",
};

export function ProviderOverviewCard({
  provider,
  totalTokens,
  requestCount,
  costUsd,
  costSource,
  remaining,
}: {
  provider: Provider;
  totalTokens: number;
  requestCount: number;
  costUsd: number | null;
  costSource: CostSource;
  remaining: RemainingQuotaValue;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">{provider.name}</CardTitle>
        <ProviderStatus status={provider.status} />
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <p className="text-muted-foreground">Tokens</p>
            <p className="font-medium">{totalTokens.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Requests</p>
            <p className="font-medium">{requestCount.toLocaleString()}</p>
          </div>
          <div className="col-span-2">
            <div className="flex items-center justify-between">
              <p className="text-muted-foreground">Cost (this period)</p>
              {COST_SOURCE_LABEL[costSource] && <Badge variant="secondary">{COST_SOURCE_LABEL[costSource]}</Badge>}
            </div>
            <p className="font-medium">{formatUsd(costUsd)}</p>
          </div>
        </div>
        <RemainingQuota quota={remaining} unit="tokens" />
      </CardContent>
    </Card>
  );
}
