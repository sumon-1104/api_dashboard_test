"use client";

import { Line, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DailyTotals } from "@/lib/usage/chart-data";

export function TokenUsageChart({ data }: { data: DailyTotals[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Token usage over time</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data} margin={{ left: 4, right: 12 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
            <YAxis tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={56} />
            <Tooltip
              contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: "var(--foreground)" }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="inputTokens" name="Input tokens" stroke="var(--chart-1)" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="outputTokens" name="Output tokens" stroke="var(--chart-2)" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="totalTokens" name="Total tokens" stroke="var(--chart-3)" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
