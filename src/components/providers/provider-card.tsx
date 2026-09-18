"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ProviderStatus } from "./provider-status";
import { PROVIDER_DISPLAY_META } from "@/lib/providers/meta";
import type { Provider } from "@/types/database";

export interface ProviderWithCredentials extends Provider {
  credentials: {
    id: string;
    keyType: string;
    name: string;
    maskedKey: string;
    status: string;
    lastTestedAt: string | null;
  }[];
}

export function ProviderCard({ provider }: { provider: ProviderWithCredentials }) {
  const router = useRouter();
  const [keyInput, setKeyInput] = useState("");
  const [showKeyField, setShowKeyField] = useState(provider.credentials.length === 0);
  const [isPending, startTransition] = useTransition();
  const meta = PROVIDER_DISPLAY_META[provider.slug];
  const credential = provider.credentials[0];

  function testConnection() {
    startTransition(async () => {
      const res = await fetch(`/api/providers/${provider.slug}/test`, { method: "POST" });
      const body = await res.json();
      if (res.ok && body.ok) {
        toast.success(`${provider.name}: ${body.message}`);
      } else {
        toast.error(`${provider.name}: ${body.message ?? "Connection failed"}`);
      }
      router.refresh();
    });
  }

  function saveKey() {
    if (!keyInput.trim()) return;
    startTransition(async () => {
      const res = await fetch(`/api/providers/${provider.slug}/credentials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: keyInput.trim() }),
      });
      if (res.ok) {
        toast.success(`${provider.name} API key saved.`);
        setKeyInput("");
        setShowKeyField(false);
        router.refresh();
      } else {
        const body = await res.json();
        toast.error(body.error ?? "Failed to save key");
      }
    });
  }

  function toggleEnabled(enabled: boolean) {
    startTransition(async () => {
      const res = await fetch(`/api/providers/${provider.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) toast.error("Failed to update provider");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle>{provider.name}</CardTitle>
          <CardDescription className="capitalize">{provider.provider_kind}-kind provider</CardDescription>
        </div>
        <ProviderStatus status={provider.status} />
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Enabled</span>
          <Switch checked={provider.enabled} onCheckedChange={toggleEnabled} disabled={isPending} />
        </div>

        {credential ? (
          <div className="rounded-md border p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-mono">{credential.maskedKey}</span>
              <span className="text-xs text-muted-foreground uppercase">{credential.keyType}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {credential.lastTestedAt
                ? `Last tested ${new Date(credential.lastTestedAt).toLocaleString()} — ${credential.status}`
                : "Never tested"}
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No credential stored yet.</p>
        )}

        {meta && <p className="text-xs text-muted-foreground">Key source: {meta.adminKeyHelp}</p>}

        {showKeyField ? (
          <div className="flex gap-2">
            <Input
              type="password"
              placeholder="Paste API key"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
            />
            <Button size="sm" onClick={saveKey} disabled={isPending || !keyInput.trim()}>
              Save
            </Button>
          </div>
        ) : null}
      </CardContent>
      <CardFooter className="flex gap-2">
        <Button variant="outline" size="sm" onClick={testConnection} disabled={isPending || !credential}>
          Test Connection
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setShowKeyField((v) => !v)} disabled={isPending}>
          {credential ? "Update API Key" : "Connect"}
        </Button>
      </CardFooter>
    </Card>
  );
}
