"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface ProviderComparisonRow {
  providerName: string;
  totalTokens: number;
}

export function ProviderComparisonChart({ data }: { data: ProviderComparisonRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Provider comparison (total tokens)</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data} layout="vertical" margin={{ left: 12, right: 24 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
            <YAxis
              type="category"
              dataKey="providerName"
              tick={{ fontSize: 12, fill: "var(--foreground)" }}
              axisLine={false}
              tickLine={false}
              width={80}
            />
            <Tooltip
              contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: "var(--foreground)" }}
            />
            <Bar dataKey="totalTokens" name="Total tokens" fill="var(--chart-1)" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
