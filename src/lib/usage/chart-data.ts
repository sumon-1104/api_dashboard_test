import type { UsageTimelineRow } from "./queries";

export interface DailyTotals {
  date: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  requestCount: number;
  estimatedCost: number;
}

/** Collapses per-provider timeline rows into one totals row per day. */
export function toDailyTotals(rows: UsageTimelineRow[]): DailyTotals[] {
  const byDay = new Map<string, DailyTotals>();

  for (const row of rows) {
    const existing = byDay.get(row.bucket) ?? {
      date: row.bucket,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      requestCount: 0,
      estimatedCost: 0,
    };
    existing.inputTokens += Number(row.input_tokens);
    existing.outputTokens += Number(row.output_tokens);
    existing.totalTokens += Number(row.total_tokens);
    existing.requestCount += Number(row.request_count);
    existing.estimatedCost += Number(row.estimated_cost ?? 0);
    byDay.set(row.bucket, existing);
  }

  return Array.from(byDay.values()).sort((a, b) => a.date.localeCompare(b.date));
}
