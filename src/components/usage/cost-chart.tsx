"use client";

import { Line, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatUsd } from "@/lib/costs";
import type { DailyTotals } from "@/lib/usage/chart-data";

export function CostChart({ data }: { data: DailyTotals[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Cost over time</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data} margin={{ left: 4, right: 12 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
            <YAxis
              tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
              width={64}
              tickFormatter={(v: number) => formatUsd(v)}
            />
            <Tooltip
              contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: "var(--foreground)" }}
              formatter={(value) => formatUsd(typeof value === "number" ? value : Number(value))}
            />
            <Line type="monotone" dataKey="estimatedCost" name="Cost" stroke="var(--chart-2)" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
