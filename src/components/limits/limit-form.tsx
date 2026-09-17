"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Provider } from "@/types/database";

const LIMIT_TYPES = [
  { value: "monthly_tokens", label: "Monthly Token Limit" },
  { value: "daily_tokens", label: "Daily Token Limit" },
  { value: "monthly_spend", label: "Monthly Spend Limit ($)" },
  { value: "requests", label: "Daily Request Limit" },
] as const;

export function LimitForm({ providers }: { providers: Provider[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [providerId, setProviderId] = useState(providers[0]?.id ?? "");
  const [limitType, setLimitType] = useState<(typeof LIMIT_TYPES)[number]["value"]>("monthly_tokens");
  const [limitValue, setLimitValue] = useState("");

  const period = limitType === "daily_tokens" || limitType === "requests" ? "daily" : "monthly";

  function submit() {
    const value = Number(limitValue);
    if (!providerId || !value || value <= 0) {
      toast.error("Enter a provider and a positive limit value.");
      return;
    }
    startTransition(async () => {
      const res = await fetch("/api/limits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider_id: providerId, limit_type: limitType, limit_value: value, period }),
      });
      if (res.ok) {
        toast.success("Limit saved.");
        setLimitValue("");
        router.refresh();
      } else {
        const body = await res.json();
        toast.error(body.error ?? "Failed to save limit");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Add a limit</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label>Provider</Label>
          <Select value={providerId} onValueChange={(v) => v && setProviderId(v)}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {providers.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Limit type</Label>
          <Select value={limitType} onValueChange={(v) => setLimitType(v as typeof limitType)}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LIMIT_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Value</Label>
          <Input
            type="number"
            className="w-36"
            value={limitValue}
            onChange={(e) => setLimitValue(e.target.value)}
            placeholder="e.g. 5000000"
          />
        </div>
        <Button onClick={submit} disabled={isPending}>
          Add limit
        </Button>
      </CardContent>
    </Card>
  );
}
