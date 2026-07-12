"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ContentBuilder } from "@/components/builder/content-builder";

interface Project {
  id: string;
  title: string;
  updatedAt: string;
}

export default function BuilderPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then(setProjects)
      .catch(() => setProjects([]));
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
            Create rich content with blocks
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" strokeWidth={1.5} />
          New Project
        </Button>
      </div>

      {projects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12">
            <FileText className="h-8 w-8 text-zinc-300" strokeWidth={1.5} />
            <p className="mt-4 text-sm text-zinc-500">No projects yet</p>
            <Button className="mt-4" onClick={() => setCreating(true)}>
              Create your first project
            </Button>
          </CardContent>
        </Card>
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
