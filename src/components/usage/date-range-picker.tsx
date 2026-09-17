"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DATE_RANGE_PRESET_LABELS, type DateRangePreset } from "@/lib/usage/date-range";

const PRESETS = Object.keys(DATE_RANGE_PRESET_LABELS) as DateRangePreset[];

export function DateRangePicker({ value }: { value: DateRangePreset }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function onChange(preset: string | null) {
    if (!preset) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", preset);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-40">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PRESETS.map((preset) => (
          <SelectItem key={preset} value={preset}>
            {DATE_RANGE_PRESET_LABELS[preset]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
