"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Provider } from "@/types/database";

export function ErrorProviderFilter({ providers, value }: { providers: Provider[]; value?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function onChange(providerId: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (!providerId || providerId === "all") params.delete("providerId");
    else params.set("providerId", providerId);
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <Select value={value ?? "all"} onValueChange={onChange}>
      <SelectTrigger className="w-48">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All providers</SelectItem>
        {providers.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            {p.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
