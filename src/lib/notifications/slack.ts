import "server-only";

// A single app-wide Slack Incoming Webhook — not a per-provider credential,
// so unlike provider API keys this is fine as a plain env var. If it isn't
// set, alerts still show on the dashboard; the cron job never hard-fails
// over a missing webhook.
export async function sendSlackAlert(message: string): Promise<boolean> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return false;

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: message }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function isSlackConfigured(): boolean {
  return Boolean(process.env.SLACK_WEBHOOK_URL);
}
