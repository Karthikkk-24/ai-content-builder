import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { NextResponse } from "next/server";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { db } from "@/lib/db";
import type { ContentBlock } from "@/lib/db/schema";
import { contentProjects } from "@/lib/db/schema";
import { blocksToMarkdown } from "@/lib/markdown-export";
import { checkPublicRateLimit, clientKeyFromRequest } from "@/lib/rate-limit";

export default async function SharePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const headerStore = await headers();
  const probe = new Request("https://localhost/share", {
    headers: {
      "x-forwarded-for": headerStore.get("x-forwarded-for") ?? "",
      "x-real-ip": headerStore.get("x-real-ip") ?? "",
      "cf-connecting-ip": headerStore.get("cf-connecting-ip") ?? "",
    },
  });
  const rateLimit = await checkPublicRateLimit(
    clientKeyFromRequest(probe),
    "share"
  );
  if (!rateLimit.allowed) {
    return new NextResponse("Too many requests. Try again shortly.", {
      status: 429,
      headers: {
        "Retry-After": String(Math.max(1, rateLimit.retryAfterSeconds)),
        "Cache-Control": "no-store",
      },
    });
  }

  const { id } = await params;
  const [project] = await db
    .select({
      id: contentProjects.id,
      title: contentProjects.title,
      blocks: contentProjects.blocks,
      updatedAt: contentProjects.updatedAt,
    })
    .from(contentProjects)
    .where(and(eq(contentProjects.id, id), eq(contentProjects.isPublic, true)))
    .limit(1);

  if (!project) {
    notFound();
  }

  const blocks = Array.isArray(project.blocks)
    ? (project.blocks as ContentBlock[])
    : [];
  const markdown = blocksToMarkdown(blocks);

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link href="/" className="text-sm font-semibold tracking-tight">
            ContentAI
          </Link>
          <p className="text-xs text-zinc-500">Shared project</p>
        </div>
      </header>
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-10">
        <div>
          <h1 className="text-3xl font-semibold text-zinc-900">
            {project.title || "Untitled"}
          </h1>
          <p className="mt-1 text-xs text-zinc-500">
            Updated {new Date(project.updatedAt).toLocaleString()}
          </p>
        </div>
        <MarkdownRenderer content={markdown} />
      </main>
    </div>
  );
}
