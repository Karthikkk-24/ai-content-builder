"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ContentBuilder } from "@/components/builder/content-builder";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { ContentBlock } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

export default function BuilderEditPage() {
  const params = useParams();
  const id = params.id as string;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("Untitled");
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadProject() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/projects/${id}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to load project");
        }

        if (!cancelled) {
          setTitle(data.title || "Untitled");
          setBlocks(Array.isArray(data.blocks) ? data.blocks : []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load project");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadProject();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
          <p className="text-sm text-zinc-600">{error}</p>
          <Link href="/builder" className={cn(buttonVariants({ variant: "outline" }))}>
            Back to projects
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <ContentBuilder
      projectId={id}
      initialTitle={title}
      initialBlocks={blocks}
    />
  );
}
