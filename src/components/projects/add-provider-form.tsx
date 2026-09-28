"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PROVIDER_CATALOG } from "@/lib/providers/meta";

const CUSTOM_VALUE = "__custom__";

export function AddProviderForm({ projectId, existingSlugs }: { projectId: string; existingSlugs: string[] }) {
  const router = useRouter();
  const [slug, setSlug] = useState("");
  const [customSlug, setCustomSlug] = useState("");
  const [name, setName] = useState("");
  const [isPending, startTransition] = useTransition();

  const available = PROVIDER_CATALOG.filter((p) => !existingSlugs.includes(p.slug));
  const isCustom = slug === CUSTOM_VALUE;

  // base-ui's Select.Value renders the raw value (a slug) unless told how to
  // format it — it doesn't auto-derive the label from SelectItem's children.
  const providerLabel: Record<string, string> = { [CUSTOM_VALUE]: "Custom..." };
  for (const p of available) providerLabel[p.slug] = `${p.name}${!p.supported ? " (coming soon)" : ""}`;

  function submit() {
    const finalSlug = isCustom
      ? customSlug.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
      : slug;
    if (!finalSlug) {
      toast.error("Pick a provider or enter a custom name.");
      return;
    }
    const finalName = name.trim() || PROVIDER_CATALOG.find((p) => p.slug === finalSlug)?.name || finalSlug;

    startTransition(async () => {
      const res = await fetch(`/api/projects/${projectId}/providers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: finalSlug, name: finalName }),
      });
      if (res.ok) {
        toast.success(`${finalName} added.`);
        setSlug("");
        setCustomSlug("");
        setName("");
        router.refresh();
      } else {
        const body = await res.json();
        toast.error(body.error ?? "Failed to add provider");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-md border border-dashed p-3">
      <div className="space-y-1.5">
        <Label>Provider</Label>
        <Select value={slug} onValueChange={(v) => v && setSlug(v)}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Choose a provider">{(value: string) => providerLabel[value] ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {available.map((p) => (
              <SelectItem key={p.slug} value={p.slug}>
                {p.name}
                {!p.supported ? " (coming soon)" : ""}
              </SelectItem>
            ))}
            <SelectItem value={CUSTOM_VALUE}>Custom...</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {isCustom && (
        <div className="space-y-1.5">
          <Label>Custom name</Label>
          <Input
            placeholder="e.g. my-internal-api"
            value={customSlug}
            onChange={(e) => setCustomSlug(e.target.value)}
            className="w-48"
          />
        </div>
      )}
      <div className="space-y-1.5">
        <Label>Display name (optional)</Label>
        <Input
          placeholder="Defaults to provider name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-56"
        />
      </div>
      <Button onClick={submit} disabled={isPending || !slug}>
        Add provider
      </Button>
    </div>
  );
}
