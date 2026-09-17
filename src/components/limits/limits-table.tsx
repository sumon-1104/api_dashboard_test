"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { UsageLimit } from "@/types/database";

const LIMIT_TYPE_LABEL: Record<string, string> = {
  monthly_tokens: "Monthly Token Limit",
  daily_tokens: "Daily Token Limit",
  monthly_spend: "Monthly Spend Limit",
  requests: "Daily Request Limit",
};

export function LimitsTable({
  limits,
  providerNameById,
}: {
  limits: UsageLimit[];
  providerNameById: Map<string, string>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function remove(id: string) {
    startTransition(async () => {
      const res = await fetch(`/api/limits/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Limit removed.");
        router.refresh();
      } else {
        toast.error("Failed to remove limit");
      }
    });
  }

  if (limits.length === 0) {
    return <p className="text-sm text-muted-foreground">No limits configured yet.</p>;
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Provider</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Period</TableHead>
            <TableHead className="text-right">Value</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {limits.map((limit) => (
            <TableRow key={limit.id}>
              <TableCell>{providerNameById.get(limit.provider_id) ?? "—"}</TableCell>
              <TableCell>{LIMIT_TYPE_LABEL[limit.limit_type] ?? limit.limit_type}</TableCell>
              <TableCell>
                <Badge variant="outline" className="capitalize">
                  {limit.period}
                </Badge>
              </TableCell>
              <TableCell className="text-right">{limit.limit_value.toLocaleString()}</TableCell>
              <TableCell>
                <Button variant="ghost" size="sm" onClick={() => remove(limit.id)} disabled={isPending}>
                  Remove
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
