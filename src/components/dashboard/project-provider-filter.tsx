"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Project, Provider } from "@/types/database";

/**
 * Two cascading dropdowns (project, then provider-within-that-project)
 * writing projectId/providerId into the URL — same pattern as
 * DateRangePicker/ErrorProviderFilter. Selecting a project narrows the
 * provider list and clears any provider selection that no longer applies;
 * "All providers" (no providerId) shows every provider under the project.
 */
export function ProjectProviderFilter({
  projects,
  providers,
  projectId,
  providerId,
}: {
  projects: Project[];
  providers: Provider[];
  projectId?: string;
  providerId?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const providersForProject = projectId ? providers.filter((p) => p.project_id === projectId) : [];

  // base-ui's Select.Value renders the raw `value` string unless told how to
  // format it — unlike Radix, it does not automatically pull the matching
  // SelectItem's children as the label — so the closed trigger needs this
  // explicit value → display-name lookup.
  const projectLabel: Record<string, string> = { all: "All projects" };
  for (const p of projects) projectLabel[p.id] = p.name;
  const providerLabel: Record<string, string> = { all: "All providers" };
  for (const p of providersForProject) providerLabel[p.id] = p.name;

  function onProjectChange(value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value || value === "all") params.delete("projectId");
    else params.set("projectId", value);
    params.delete("providerId");
    router.push(`${pathname}?${params.toString()}`);
  }

  function onProviderChange(value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value || value === "all") params.delete("providerId");
    else params.set("providerId", value);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex gap-2">
      <Select value={projectId ?? "all"} onValueChange={onProjectChange}>
        <SelectTrigger className="w-48">
          <SelectValue>{(value: string) => projectLabel[value] ?? value}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All projects</SelectItem>
          {projects.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={providerId ?? "all"} onValueChange={onProviderChange} disabled={!projectId}>
        <SelectTrigger className="w-48">
          <SelectValue placeholder="All providers">{(value: string) => providerLabel[value] ?? value}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All providers</SelectItem>
          {providersForProject.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
