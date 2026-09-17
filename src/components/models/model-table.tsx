"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { formatUsd } from "@/lib/costs";
import type { Model } from "@/types/database";

export interface ModelRow extends Model {
  providerName: string;
  requestCount: number;
  totalTokens: number;
  costUsd: number | null;
}

export function ModelTable({ initialRows }: { initialRows: ModelRow[] }) {
  const [rows, setRows] = useState(initialRows);
  const [isPending, startTransition] = useTransition();

  function patchModel(id: string, patch: Partial<Pick<Model, "enabled" | "input_price_per_million" | "output_price_per_million">>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    startTransition(async () => {
      const res = await fetch(`/api/models/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) toast.error("Failed to update model");
    });
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Provider</TableHead>
            <TableHead>Model</TableHead>
            <TableHead>Input $/1M</TableHead>
            <TableHead>Output $/1M</TableHead>
            <TableHead className="text-right">Requests</TableHead>
            <TableHead className="text-right">Tokens</TableHead>
            <TableHead className="text-right">Cost</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>{row.providerName}</TableCell>
              <TableCell className="font-mono text-xs">{row.model_name}</TableCell>
              <TableCell>
                <Input
                  type="number"
                  step="0.01"
                  className="h-8 w-24"
                  defaultValue={row.input_price_per_million ?? ""}
                  placeholder="N/A"
                  disabled={isPending}
                  onBlur={(e) => {
                    const v = e.target.value === "" ? null : Number(e.target.value);
                    if (v !== row.input_price_per_million) patchModel(row.id, { input_price_per_million: v });
                  }}
                />
              </TableCell>
              <TableCell>
                <Input
                  type="number"
                  step="0.01"
                  className="h-8 w-24"
                  defaultValue={row.output_price_per_million ?? ""}
                  placeholder="N/A"
                  disabled={isPending}
                  onBlur={(e) => {
                    const v = e.target.value === "" ? null : Number(e.target.value);
                    if (v !== row.output_price_per_million) patchModel(row.id, { output_price_per_million: v });
                  }}
                />
              </TableCell>
              <TableCell className="text-right">{row.requestCount.toLocaleString()}</TableCell>
              <TableCell className="text-right">{row.totalTokens.toLocaleString()}</TableCell>
              <TableCell className="text-right">{formatUsd(row.costUsd)}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={row.enabled}
                    onCheckedChange={(enabled) => patchModel(row.id, { enabled })}
                    disabled={isPending}
                  />
                  <Badge variant={row.enabled ? "default" : "outline"}>{row.enabled ? "Enabled" : "Disabled"}</Badge>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
