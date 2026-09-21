import { createClient } from "@/lib/supabase/server";
import { getModels, getProjects, getProviders, getUsageByModel } from "@/lib/usage/queries";
import { calculateTokenCost } from "@/lib/costs";
import { ModelTable, type ModelRow } from "@/components/models/model-table";
import { ProjectProviderFilter } from "@/components/dashboard/project-provider-filter";

export default async function ModelsPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string; providerId?: string }>;
}) {
  const { projectId, providerId } = await searchParams;
  const filter = { projectId, providerId };

  const supabase = await createClient();
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const [models, projects, allProviders, usageByModel] = await Promise.all([
    getModels(supabase),
    getProjects(supabase),
    getProviders(supabase),
    getUsageByModel(supabase, { start, end: now }, filter),
  ]);

  const visibleProviderIds = new Set(
    (providerId
      ? allProviders.filter((p) => p.id === providerId)
      : projectId
        ? allProviders.filter((p) => p.project_id === projectId)
        : allProviders
    ).map((p) => p.id)
  );

  const providerNameById = new Map(allProviders.map((p) => [p.id, p.name]));
  const usageByModelId = new Map(usageByModel.map((u) => [u.model_id, u]));

  const rows: ModelRow[] = models
    .filter((model) => visibleProviderIds.has(model.provider_id))
    .map((model) => {
      const usage = usageByModelId.get(model.id);
      const inputTokens = Number(usage?.input_tokens ?? 0);
      const outputTokens = Number(usage?.output_tokens ?? 0);
      const costUsd = calculateTokenCost({
        inputTokens,
        outputTokens,
        inputPricePerMillion: model.input_price_per_million,
        outputPricePerMillion: model.output_price_per_million,
      });

      return {
        ...model,
        providerName: providerNameById.get(model.provider_id) ?? "Unknown",
        requestCount: Number(usage?.request_count ?? 0),
        totalTokens: Number(usage?.total_tokens ?? 0),
        costUsd,
      };
    });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Models</h1>
          <p className="text-sm text-muted-foreground">
            Pricing drives every cost calculation — set it here once per model. Month-to-date usage shown.
          </p>
        </div>
        <ProjectProviderFilter
          projects={projects}
          providers={allProviders}
          projectId={projectId}
          providerId={providerId}
        />
      </div>
      {rows.length === 0 ? (
        <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          No models yet. Models appear here automatically once usage is polled, or add pricing after the first poll.
        </p>
      ) : (
        <ModelTable initialRows={rows} />
      )}
    </div>
  );
}
