import { createClient } from "@/lib/supabase/server";
import { getProviders, getUsageSummaryByProvider, getUsageTimeline } from "@/lib/usage/queries";
import { resolvePreset, type DateRangePreset } from "@/lib/usage/date-range";
import { toDailyTotals } from "@/lib/usage/chart-data";
import { DateRangePicker } from "@/components/usage/date-range-picker";
import { TokenUsageChart } from "@/components/usage/token-usage-chart";
import { RequestUsageChart } from "@/components/usage/request-usage-chart";
import { CostChart } from "@/components/usage/cost-chart";
import { ProviderComparisonChart } from "@/components/usage/provider-comparison-chart";

const VALID_PRESETS: DateRangePreset[] = ["today", "7d", "30d", "this_month", "last_month", "custom"];

export default async function UsagePage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const params = await searchParams;
  const preset = VALID_PRESETS.includes(params.range as DateRangePreset) ? (params.range as DateRangePreset) : "7d";
  const range = resolvePreset(preset);

  const supabase = await createClient();
  const [providers, timeline, summary] = await Promise.all([
    getProviders(supabase),
    getUsageTimeline(supabase, range),
    getUsageSummaryByProvider(supabase, range),
  ]);

  const providerNameById = new Map(providers.map((p) => [p.id, p.name]));
  const dailyTotals = toDailyTotals(timeline);
  const comparisonData = summary.map((row) => ({
    providerName: providerNameById.get(row.provider_id) ?? row.provider_id,
    totalTokens: Number(row.total_tokens),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Usage</h1>
          <p className="text-sm text-muted-foreground">Token, request, and cost trends across all providers.</p>
        </div>
        <DateRangePicker value={preset} />
      </div>

      {dailyTotals.length === 0 ? (
        <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          No usage data for this range yet. Once providers are connected, the cron poller will populate this chart.
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <TokenUsageChart data={dailyTotals} />
          <RequestUsageChart data={dailyTotals} />
          <CostChart data={dailyTotals} />
          <ProviderComparisonChart data={comparisonData} />
        </div>
      )}
    </div>
  );
}
