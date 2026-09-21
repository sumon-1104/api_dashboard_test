import { createClient } from "@/lib/supabase/server";
import { getProjects, getProviders, getRateLimits, getUsageLimits } from "@/lib/usage/queries";
import { LimitForm } from "@/components/limits/limit-form";
import { LimitsTable } from "@/components/limits/limits-table";
import { RateLimitCard } from "@/components/usage/rate-limit-card";
import { ProjectProviderFilter } from "@/components/dashboard/project-provider-filter";

export default async function LimitsPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string; providerId?: string }>;
}) {
  const { projectId, providerId } = await searchParams;

  const supabase = await createClient();
  const [projects, allProviders, limits, rateLimits] = await Promise.all([
    getProjects(supabase),
    getProviders(supabase),
    getUsageLimits(supabase),
    getRateLimits(supabase),
  ]);

  const visibleProviders = providerId
    ? allProviders.filter((p) => p.id === providerId)
    : projectId
      ? allProviders.filter((p) => p.project_id === projectId)
      : allProviders;
  const visibleProviderIds = new Set(visibleProviders.map((p) => p.id));

  const providerNameById = new Map(allProviders.map((p) => [p.id, p.name]));
  const visibleLimits = limits.filter((l) => visibleProviderIds.has(l.provider_id));

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Limits</h1>
          <p className="text-sm text-muted-foreground">
            Application-enforced spending guardrails. Crossing 50/75/90/100% of any limit below fires a dashboard and
            Slack alert (see Settings).
          </p>
        </div>
        <ProjectProviderFilter
          projects={projects}
          providers={allProviders}
          projectId={projectId}
          providerId={providerId}
        />
      </div>

      <div className="space-y-4">
        <LimitForm providers={allProviders} />
        <LimitsTable limits={visibleLimits} providerNameById={providerNameById} />
      </div>

      <div>
        <h2 className="mb-3 text-lg font-medium">Provider-reported rate limits</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {visibleProviders.map((provider) => (
            <RateLimitCard
              key={provider.id}
              providerName={provider.name}
              limits={rateLimits.filter((rl) => rl.provider_id === provider.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
