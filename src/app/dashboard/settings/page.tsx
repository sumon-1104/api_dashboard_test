import { createClient } from "@/lib/supabase/server";
import { getProviders, getRecentAlerts } from "@/lib/usage/queries";
import { isSlackConfigured } from "@/lib/notifications/slack";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function SettingsPage() {
  const supabase = await createClient();
  const [alerts, providers] = await Promise.all([getRecentAlerts(supabase, 20), getProviders(supabase)]);
  const providerNameById = new Map(providers.map((p) => [p.id, p.name]));
  const slackConfigured = isSlackConfigured();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Notification delivery and recent alert history.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span>Slack webhook</span>
            <Badge variant={slackConfigured ? "default" : "outline"}>
              {slackConfigured ? "Configured" : "Not configured (SLACK_WEBHOOK_URL unset)"}
            </Badge>
          </div>
          {!slackConfigured && (
            <p className="text-xs text-muted-foreground">
              Alerts still appear on the dashboard below without Slack — the cron job never fails over a missing
              webhook. Set <code className="font-mono">SLACK_WEBHOOK_URL</code> to also post to Slack.
            </p>
          )}

          <div>
            <h3 className="mb-2 text-sm font-medium">Recent alerts</h3>
            {alerts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No thresholds crossed yet.</p>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Provider</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Threshold</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead>Channel</TableHead>
                      <TableHead>Delivered</TableHead>
                      <TableHead>Triggered</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {alerts.map((alert) => (
                      <TableRow key={alert.id}>
                        <TableCell>{providerNameById.get(alert.provider_id) ?? "—"}</TableCell>
                        <TableCell className="capitalize">{alert.limit_type.replace("_", " ")}</TableCell>
                        <TableCell>{alert.threshold_pct}%</TableCell>
                        <TableCell>{alert.period_key}</TableCell>
                        <TableCell className="capitalize">{alert.channel}</TableCell>
                        <TableCell>
                          <Badge variant={alert.delivered ? "default" : "outline"}>
                            {alert.delivered ? "Sent" : "Not sent"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(alert.triggered_at).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
