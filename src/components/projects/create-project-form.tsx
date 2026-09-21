"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CreateProjectForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [isPending, startTransition] = useTransition();

  function submit() {
    if (!name.trim()) return;
    startTransition(async () => {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (res.ok) {
        const body = await res.json();
        toast.success(`Project "${body.project.name}" created.`);
        router.push(`/dashboard/projects/${body.project.id}`);
      } else {
        const body = await res.json();
        toast.error(body.error ?? "Failed to create project");
      }
    });
  }

  return (
    <div className="flex gap-2">
      <Input
        placeholder="Project name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="max-w-xs"
      />
      <Button onClick={submit} disabled={isPending || !name.trim()}>
        Create project
      </Button>
    </div>
  );
}
