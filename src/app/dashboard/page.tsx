import { Activity, Coins, ArrowDownToLine, ArrowUpFromLine, Hash, Plug } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getModels, getProviders, getUsageByModel, getUsageLimits, getUsageSummaryByProvider } from "@/lib/usage/queries";
import { UsageSummaryCard } from "@/components/dashboard/usage-summary-card";
import { ProviderOverviewCard } from "@/components/dashboard/provider-overview-card";
import { tokenRemainingForProvider } from "@/lib/usage/provider-remaining";
import { calculateTokenCost, formatUsd, resolveCost } from "@/lib/costs";

export default async function OverviewPage() {
  const supabase = await createClient();

  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const [providers, summary, usageByModel, models, limits] = await Promise.all([
    getProviders(supabase),
    getUsageSummaryByProvider(supabase, { start, end: now }),
    getUsageByModel(supabase, { start, end: now }),
    getModels(supabase),
    getUsageLimits(supabase),
  ]);

  const summaryByProvider = new Map(summary.map((r) => [r.provider_id, r]));
  const activeProviders = providers.filter((p) => p.enabled && p.status === "connected").length;

  // Per-model rows carry tokens but not a provider's own reported cost for
  // that slice, so a provider without a Cost API (e.g. Gemini) never gets a
  // number here unless we apply the price an admin set on the Models page —
  // resolveCost() below still prefers a real provider-reported total over
  // this when one exists, so this never double-counts OpenAI/Anthropic's
  // real Cost API totals.
  const modelById = new Map(models.map((m) => [m.id, m]));
  const calculatedCostByProvider = new Map<string, { sum: number; anyPriced: boolean }>();
  for (const row of usageByModel) {
    const model = row.model_id ? modelById.get(row.model_id) : undefined;
    const calculated = model
      ? calculateTokenCost({
          inputTokens: Number(row.input_tokens),
          outputTokens: Number(row.output_tokens),
          inputPricePerMillion: model.input_price_per_million,
          outputPricePerMillion: model.output_price_per_million,
        })
      : null;
    const entry = calculatedCostByProvider.get(row.provider_id) ?? { sum: 0, anyPriced: false };
    if (calculated != null) {
      entry.sum += calculated;
      entry.anyPriced = true;
    }
    calculatedCostByProvider.set(row.provider_id, entry);
  }

  const resolvedCostByProvider = new Map(
    providers.map((provider) => {
      const row = summaryByProvider.get(provider.id);
      const providerReportedCostUsd = row?.estimated_cost != null ? Number(row.estimated_cost) : null;
      const calcEntry = calculatedCostByProvider.get(provider.id);
      const calculatedCostUsd = calcEntry?.anyPriced ? calcEntry.sum : null;
      return [provider.id, resolveCost(providerReportedCostUsd, calculatedCostUsd)] as const;
    })
  );

  const totals = summary.reduce(
    (acc, r) => ({
      requestCount: acc.requestCount + Number(r.request_count),
      totalTokens: acc.totalTokens + Number(r.total_tokens),
      inputTokens: acc.inputTokens + Number(r.input_tokens),
      outputTokens: acc.outputTokens + Number(r.output_tokens),
      estimatedCost: acc.estimatedCost + (resolvedCostByProvider.get(r.provider_id)?.costUsd ?? 0),
    }),
    { requestCount: 0, totalTokens: 0, inputTokens: 0, outputTokens: 0, estimatedCost: 0 }
  );

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
            const resolved = resolvedCostByProvider.get(provider.id) ?? { costUsd: null, source: "unavailable" as const };
            return (
              <ProviderOverviewCard
                key={provider.id}
                provider={provider}
                totalTokens={totalTokens}
                requestCount={Number(row?.request_count ?? 0)}
                costUsd={resolved.costUsd}
                costSource={resolved.source}
                remaining={remaining}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
