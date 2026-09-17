import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { RateLimit } from "@/types/database";

export function RateLimitCard({ providerName, limits }: { providerName: string; limits: RateLimit[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{providerName} rate limits</CardTitle>
      </CardHeader>
      <CardContent>
        {limits.length === 0 ? (
          <p className="text-sm text-muted-foreground">Not available from provider.</p>
        ) : (
          <ul className="space-y-2">
            {limits.map((limit) => (
              <li key={limit.id} className="flex items-center justify-between text-sm">
                <span className="font-mono text-xs text-muted-foreground">{limit.limit_type}</span>
                <span className="flex items-center gap-2">
                  {limit.limit_value != null ? limit.limit_value.toLocaleString() : "—"}
                  <Badge variant="outline" className="text-[10px]">
                    {limit.source === "provider_reported" ? "Configured limit" : "Response headers"}
                  </Badge>
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
