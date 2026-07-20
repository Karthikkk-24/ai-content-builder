"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ContentBuilder } from "@/components/builder/content-builder";
import { getApiErrorMessage } from "@/lib/api/client-error";

interface Project {
  id: string;
  title: string;
  updatedAt: string;
}

export default function BuilderPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/projects")
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) {
          throw new Error(getApiErrorMessage(data, "Failed to load projects"));
        }
        setProjects(data);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load projects");
        setProjects([]);
      })
      .finally(() => setLoading(false));
  }, []);

  if (creating) {
    return (
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="mb-4"
          onClick={() => setCreating(false)}
        >
          Back to projects
        </Button>
        <ContentBuilder />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Content Builder</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Edit and export your AI-generated content
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" strokeWidth={1.5} />
          New Project
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
          Loading projects...
        </div>
      ) : error ? (
        <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
          {error}
        </div>
      ) : projects.length === 0 ? (
        <div className="space-y-4">
          <p className="text-sm text-zinc-400">
            No projects yet. Generate content with AI tools or create a blank project.
          </p>
          <Button onClick={() => setCreating(true)}>
            Create your first project
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Link key={project.id} href={`/builder/${project.id}`}>
              <Card className="transition-colors hover:bg-zinc-50">
                <CardContent className="p-4">
                  <FileText className="h-5 w-5 text-zinc-900" strokeWidth={1.5} />
                  <h3 className="mt-3 text-sm font-medium text-zinc-900">
                    {project.title}
                  </h3>
                  <p className="mt-1 text-xs text-zinc-400">
                    Updated {new Date(project.updatedAt).toLocaleDateString()}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
