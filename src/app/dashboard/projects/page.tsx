import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getProjects } from "@/lib/usage/queries";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CreateProjectForm } from "@/components/projects/create-project-form";

export default async function ProjectsPage() {
  const supabase = await createClient();
  const projects = await getProjects(supabase);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
        <p className="text-sm text-muted-foreground">Create a project, then add providers and API keys under it.</p>
      </div>

      <CreateProjectForm />

      {projects.length === 0 ? (
        <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          No projects yet — create one above to get started.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Link key={project.id} href={`/dashboard/projects/${project.id}`}>
              <Card className="transition-colors hover:bg-accent/50">
                <CardHeader>
                  <CardTitle className="text-base">{project.name}</CardTitle>
                  <CardDescription>Created {new Date(project.created_at).toLocaleDateString()}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
