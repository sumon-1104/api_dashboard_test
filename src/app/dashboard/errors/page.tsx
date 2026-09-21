import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getModels, getProjects, getProviders, getRecentErrors } from "@/lib/usage/queries";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ProjectProviderFilter } from "@/components/dashboard/project-provider-filter";

const PAGE_SIZE = 25;

export default async function ErrorsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; projectId?: string; providerId?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? "1"));
  const { projectId, providerId } = params;

  const supabase = await createClient();
  const [projects, providers, models] = await Promise.all([
    getProjects(supabase),
    getProviders(supabase),
    getModels(supabase),
  ]);

  const providerIdsForProject = projectId ? providers.filter((p) => p.project_id === projectId).map((p) => p.id) : undefined;

  const { data: errors, count } = await getRecentErrors(supabase, {
    page,
    pageSize: PAGE_SIZE,
    providerId,
    providerIds: providerId ? undefined : providerIdsForProject,
  });

  const providerNameById = new Map(providers.map((p) => [p.id, p.name]));
  const modelNameById = new Map(models.map((m) => [m.id, m.display_name]));
  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  function pageHref(target: number) {
    const params = new URLSearchParams();
    if (projectId) params.set("projectId", projectId);
    if (providerId) params.set("providerId", providerId);
    params.set("page", String(target));
    return `?${params.toString()}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Errors</h1>
          <p className="text-sm text-muted-foreground">API errors captured during polling or connection tests.</p>
        </div>
        <ProjectProviderFilter projects={projects} providers={providers} projectId={projectId} providerId={providerId} />
      </div>

      {errors && errors.length > 0 ? (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Provider</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Error Code</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>Request ID</TableHead>
                <TableHead>Timestamp</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {errors.map((err) => (
                <TableRow key={err.id}>
                  <TableCell>{providerNameById.get(err.provider_id) ?? "—"}</TableCell>
                  <TableCell>{err.model_id ? (modelNameById.get(err.model_id) ?? "—") : "—"}</TableCell>
                  <TableCell>{err.status_code ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{err.error_code ?? "—"}</TableCell>
                  <TableCell className="max-w-xs truncate text-sm" title={err.message ?? ""}>
                    {err.message ?? "—"}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{err.request_id ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(err.created_at).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          No errors recorded.
        </p>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            {page > 1 ? (
              <Button render={<Link href={pageHref(page - 1)} />} variant="outline" size="sm">
                Previous
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled>
                Previous
              </Button>
            )}
            {page < totalPages ? (
              <Button render={<Link href={pageHref(page + 1)} />} variant="outline" size="sm">
                Next
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled>
                Next
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
