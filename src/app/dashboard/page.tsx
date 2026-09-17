import { Activity, Coins, ArrowDownToLine, ArrowUpFromLine, Hash, Plug } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getProviders, getUsageLimits, getUsageSummaryByProvider } from "@/lib/usage/queries";
import { UsageSummaryCard } from "@/components/dashboard/usage-summary-card";
import { ProviderOverviewCard } from "@/components/dashboard/provider-overview-card";
import { tokenRemainingForProvider } from "@/lib/usage/provider-remaining";
import { formatUsd } from "@/lib/costs";

export default async function OverviewPage() {
  const supabase = await createClient();

  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const [providers, summary, limits] = await Promise.all([
    getProviders(supabase),
    getUsageSummaryByProvider(supabase, { start, end: now }),
    getUsageLimits(supabase),
  ]);

  const totals = summary.reduce(
    (acc, r) => ({
      requestCount: acc.requestCount + Number(r.request_count),
      totalTokens: acc.totalTokens + Number(r.total_tokens),
      inputTokens: acc.inputTokens + Number(r.input_tokens),
      outputTokens: acc.outputTokens + Number(r.output_tokens),
      estimatedCost: acc.estimatedCost + Number(r.estimated_cost),
    }),
    { requestCount: 0, totalTokens: 0, inputTokens: 0, outputTokens: 0, estimatedCost: 0 }
  );

  const summaryByProvider = new Map(summary.map((r) => [r.provider_id, r]));
  const activeProviders = providers.filter((p) => p.enabled && p.status === "connected").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="text-sm text-muted-foreground">Month to date, across all connected providers.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <UsageSummaryCard label="Total Requests" value={totals.requestCount.toLocaleString()} icon={Activity} />
        <UsageSummaryCard label="Total Tokens" value={totals.totalTokens.toLocaleString()} icon={Hash} />
        <UsageSummaryCard label="Input Tokens" value={totals.inputTokens.toLocaleString()} icon={ArrowDownToLine} />
        <UsageSummaryCard label="Output Tokens" value={totals.outputTokens.toLocaleString()} icon={ArrowUpFromLine} />
        <UsageSummaryCard label="Estimated Cost" value={formatUsd(totals.estimatedCost)} icon={Coins} />
        <UsageSummaryCard label="Active Providers" value={`${activeProviders} / ${providers.length}`} icon={Plug} />
      </div>

      <div>
        <h2 className="mb-3 text-lg font-medium">By provider</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {providers.map((provider) => {
            const row = summaryByProvider.get(provider.id);
            const totalTokens = Number(row?.total_tokens ?? 0);
            const remaining = tokenRemainingForProvider(limits, provider.id, totalTokens);
            return (
              <ProviderOverviewCard
                key={provider.id}
                provider={provider}
                totalTokens={totalTokens}
                requestCount={Number(row?.request_count ?? 0)}
                costUsd={row ? Number(row.estimated_cost) : null}
                remaining={remaining}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
