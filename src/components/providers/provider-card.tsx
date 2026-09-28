"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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

export function ProviderCard({ provider, projectId }: { provider: ProviderWithCredentials; projectId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showAddForm, setShowAddForm] = useState(provider.credentials.length === 0);
  const [keyInput, setKeyInput] = useState("");
  const [extraFieldInput, setExtraFieldInput] = useState("");
  const meta = PROVIDER_DISPLAY_META[provider.slug];
  const supported = meta?.supported ?? false;
  const extraConfigField = meta?.extraConfigField;
  const basePath = `/api/projects/${projectId}/providers/${provider.slug}`;

  function testCredential(credentialId: string) {
    startTransition(async () => {
      const res = await fetch(`${basePath}/credentials/${credentialId}/test`, { method: "POST" });
      const body = await res.json();
      if (res.ok && body.ok) {
        toast.success(`${provider.name}: ${body.message}`);
      } else {
        toast.error(`${provider.name}: ${body.message ?? "Connection failed"}`);
      }
      router.refresh();
    });
  }

  function removeCredential(credentialId: string, name: string) {
    if (!window.confirm(`Remove key "${name}"? It will be deleted; historical usage data is kept.`)) {
      return;
    }
    startTransition(async () => {
      const res = await fetch(`${basePath}/credentials/${credentialId}`, { method: "DELETE" });
      if (res.ok) {
        toast.success(`Removed "${name}".`);
        router.refresh();
      } else {
        const body = await res.json().catch(() => ({}));
        toast.error(body.error ?? "Failed to remove key");
      }
    });
  }

  function addKey() {
    if (!keyInput.trim()) return;
    if (extraConfigField && !extraFieldInput.trim()) return;
    startTransition(async () => {
      const res = await fetch(`${basePath}/credentials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: keyInput.trim(),
          ...(extraConfigField ? { config: { [extraConfigField.key]: extraFieldInput.trim() } } : {}),
        }),
      });
      if (res.ok) {
        toast.success(`Key saved.`);
        setKeyInput("");
        setExtraFieldInput("");
        setShowAddForm(false);
        router.refresh();
      } else {
        const body = await res.json();
        toast.error(body.error ?? "Failed to save key");
      }
    });
  }

  function toggleEnabled(enabled: boolean) {
    startTransition(async () => {
      const res = await fetch(basePath, {
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

        {!supported && (
          <p className="text-xs text-amber-600 dark:text-amber-500">
            No live integration yet for this provider — keys are stored, but Test Connection and polling
            aren&apos;t available until real support is added.
          </p>
        )}

        {provider.credentials.length === 0 ? (
          <p className="text-sm text-muted-foreground">No keys added yet.</p>
        ) : (
          <div className="space-y-2">
            {provider.credentials.map((cred) => (
              <div key={cred.id} className="rounded-md border p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{cred.name}</span>
                  <span className="text-xs text-muted-foreground uppercase">{cred.keyType}</span>
                </div>
                <p className="mt-1 font-mono text-xs">{cred.maskedKey}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {cred.lastTestedAt
                    ? `Last tested ${new Date(cred.lastTestedAt).toLocaleString()} — ${cred.status}`
                    : "Never tested"}
                </p>
                <div className="mt-2 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => testCredential(cred.id)}
                    disabled={isPending || !supported}
                  >
                    Test Connection
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeCredential(cred.id, cred.name)}
                    disabled={isPending}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {meta?.adminKeyHelp && <p className="text-xs text-muted-foreground">Key source: {meta.adminKeyHelp}</p>}

        {showAddForm ? (
          <div className="space-y-2 rounded-md border border-dashed p-3">
            <Input
              type="password"
              placeholder="Paste API key"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
            />
            {extraConfigField && (
              <Input
                placeholder={extraConfigField.placeholder}
                value={extraFieldInput}
                onChange={(e) => setExtraFieldInput(e.target.value)}
              />
            )}
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={addKey}
                disabled={isPending || !keyInput.trim() || (!!extraConfigField && !extraFieldInput.trim())}
              >
                Save key
              </Button>
              {provider.credentials.length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setShowAddForm(false)} disabled={isPending}>
                  Cancel
                </Button>
              )}
            </div>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setShowAddForm(true)} disabled={isPending}>
            {provider.credentials.length > 0 ? "Replace key" : "+ Add key"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
