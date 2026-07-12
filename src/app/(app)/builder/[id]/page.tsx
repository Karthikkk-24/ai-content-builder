"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ContentBuilder } from "@/components/builder/content-builder";
import { Skeleton } from "@/components/ui/skeleton";
import type { ContentBlock } from "@/lib/db/schema";

export default function BuilderEditPage() {
  const params = useParams();
  const id = params.id as string;
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("Untitled");
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);

  useEffect(() => {
    fetch(`/api/projects/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setTitle(data.title || "Untitled");
        setBlocks(data.blocks || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
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
