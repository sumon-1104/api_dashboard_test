import { createClient } from "@/lib/supabase/server";
import { getProviders, getRateLimits, getUsageLimits } from "@/lib/usage/queries";
import { LimitForm } from "@/components/limits/limit-form";
import { LimitsTable } from "@/components/limits/limits-table";
import { RateLimitCard } from "@/components/usage/rate-limit-card";

export default async function LimitsPage() {
  const supabase = await createClient();
  const [providers, limits, rateLimits] = await Promise.all([
    getProviders(supabase),
    getUsageLimits(supabase),
    getRateLimits(supabase),
  ]);

  const providerNameById = new Map(providers.map((p) => [p.id, p.name]));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Limits</h1>
        <p className="text-sm text-muted-foreground">
          Application-enforced spending guardrails. Crossing 50/75/90/100% of any limit below fires a dashboard and
          Slack alert (see Settings).
        </p>
      </div>

      <div className="space-y-4">
        <LimitForm providers={providers} />
        <LimitsTable limits={limits} providerNameById={providerNameById} />
      </div>

      <div>
        <h2 className="mb-3 text-lg font-medium">Provider-reported rate limits</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {providers.map((provider) => (
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
