import {
  startOfDay,
  endOfDay,
  startOfMonth,
  endOfMonth,
  subDays,
  subMonths,
} from "date-fns";

export type DateRangePreset = "today" | "7d" | "30d" | "this_month" | "last_month" | "custom";

export interface ResolvedRange {
  start: Date;
  end: Date;
}

export function resolvePreset(preset: DateRangePreset, now: Date = new Date()): ResolvedRange {
  switch (preset) {
    case "today":
      return { start: startOfDay(now), end: endOfDay(now) };
    case "7d":
      return { start: startOfDay(subDays(now, 6)), end: endOfDay(now) };
    case "30d":
      return { start: startOfDay(subDays(now, 29)), end: endOfDay(now) };
    case "this_month":
      return { start: startOfMonth(now), end: endOfDay(now) };
    case "last_month": {
      const lastMonth = subMonths(now, 1);
      return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
    }
    case "custom":
      return { start: startOfDay(subDays(now, 6)), end: endOfDay(now) };
  }
}

export const DATE_RANGE_PRESET_LABELS: Record<DateRangePreset, string> = {
  today: "Today",
  "7d": "7 Days",
  "30d": "30 Days",
  this_month: "This Month",
  last_month: "Last Month",
  custom: "Custom",
};
