import { randomUUID } from "crypto";
import { desc, eq, and, isNull } from "drizzle-orm";
import { invalidateUserCache } from "@/lib/cache";
import { db } from "@/lib/db";
import type { ContentBlock } from "@/lib/db/schema";
import { contentProjects, generations } from "@/lib/db/schema";
import { isAllowedContentImageUrl } from "@/lib/content-blocks";
import {
  GENERATED_IMAGE_PLACEHOLDER,
  sanitizeGeneratedOutputForStorage,
} from "@/lib/image-utils";
import { sanitizeBlockContentForMarkdown } from "@/lib/markdown-export";

const MAX_TITLE_LENGTH = 60;
export const SYNC_GENERATIONS_TO_PROJECTS_BATCH = 20;

/**
 * neon-http has no Drizzle transactions. If project creation fails after a
 * generation insert, delete the generation so clients don't see orphan history.
 */
export async function withGenerationProjectRollback<T>(
  generationId: string,
  userId: string,
  work: () => Promise<T>
): Promise<T> {
  try {
    return await work();
  } catch (error) {
    try {
      await db
        .delete(generations)
        .where(
          and(eq(generations.id, generationId), eq(generations.userId, userId))
        );
      await invalidateUserCache(userId);
    } catch (rollbackError) {
      console.error(
        "Failed to roll back generation after project save failure:",
        rollbackError
      );
    }
    throw error;
  }
}

function buildTitle(prompt: string, type: string): string {
  const trimmed = prompt.trim();
  if (!trimmed) return `${type} draft`;
  if (trimmed.length <= MAX_TITLE_LENGTH) return trimmed;
  return `${trimmed.slice(0, MAX_TITLE_LENGTH - 3)}...`;
}

function formatTypeLabel(type: string): string {
  return type.replaceAll("_", " ");
}

export async function saveTextGenerationAsProject({
  userId,
  type,
  prompt,
  output,
  generationId,
}: {
  userId: string;
  type: string;
  prompt: string;
  output: string;
  generationId?: string;
}): Promise<string> {
  const blocks: ContentBlock[] = [
    {
      id: randomUUID(),
      type: "heading",
      content: sanitizeBlockContentForMarkdown(
        formatTypeLabel(type),
        "heading"
      ),
      level: 2,
    },
    {
      id: randomUUID(),
      type: "paragraph",
      content: sanitizeBlockContentForMarkdown(output, "paragraph"),
    },
  ];

  const [project] = await db
    .insert(contentProjects)
    .values({
      userId,
      title: buildTitle(prompt, type),
      blocks,
      ...(generationId ? { generationId } : {}),
    })
    .returning({ id: contentProjects.id });

  await invalidateUserCache(userId);
  return project.id;
}

/**
 * Persist only URLs that later PATCH/save can accept. Oversized data URLs
 * become an empty image `url` instead of a sentinel that fails Zod.
 */
export function toProjectImageUrl(raw: string): string {
  const stored = sanitizeGeneratedOutputForStorage(raw);
  if (!stored || stored === GENERATED_IMAGE_PLACEHOLDER) return "";
  return isAllowedContentImageUrl(stored) ? stored : "";
}

export async function saveImageGenerationAsProject({
  userId,
  type,
  prompt,
  imageUrl,
  generationId,
}: {
  userId: string;
  type: string;
  prompt: string;
  imageUrl: string;
  generationId?: string;
}): Promise<string> {
  const blocks: ContentBlock[] = [
    {
      id: randomUUID(),
      type: "heading",
      content: sanitizeBlockContentForMarkdown(
        formatTypeLabel(type),
        "heading"
      ),
      level: 2,
    },
    {
      id: randomUUID(),
      type: "image",
      content: sanitizeBlockContentForMarkdown(prompt, "plain"),
      url: toProjectImageUrl(imageUrl),
    },
    {
      id: randomUUID(),
      type: "paragraph",
      content: sanitizeBlockContentForMarkdown(prompt, "paragraph"),
    },
  ];

  const [project] = await db
    .insert(contentProjects)
    .values({
      userId,
      title: buildTitle(prompt, type),
      blocks,
      ...(generationId ? { generationId } : {}),
    })
    .returning({ id: contentProjects.id });

  await invalidateUserCache(userId);
  return project.id;
}

export async function syncGenerationsToProjects(userId: string): Promise<number> {
  const unlinked = await db
    .select({
      id: generations.id,
      type: generations.type,
      inputPrompt: generations.inputPrompt,
      outputContent: generations.outputContent,
      createdAt: generations.createdAt,
      referenceImageUrl: generations.referenceImageUrl,
    })
    .from(generations)
    .leftJoin(contentProjects, eq(contentProjects.generationId, generations.id))
    .where(
      and(
        eq(generations.userId, userId),
        isNull(contentProjects.id)
      )
    )
    .orderBy(desc(generations.createdAt))
    .limit(SYNC_GENERATIONS_TO_PROJECTS_BATCH);

  if (unlinked.length === 0) {
    return 0;
  }

  for (const item of unlinked) {
    if (item.type === "poster" || item.type === "photo") {
      const imageUrl = toProjectImageUrl(item.outputContent);

      if (!imageUrl) {
        await saveTextGenerationAsProject({
          userId,
          type: item.type,
          prompt: item.inputPrompt,
          output: item.inputPrompt,
          generationId: item.id,
        });
        continue;
      }

      await saveImageGenerationAsProject({
        userId,
        type: item.type,
        prompt: item.inputPrompt,
        imageUrl,
        generationId: item.id,
      });
    } else {
      await saveTextGenerationAsProject({
        userId,
        type: item.type,
        prompt: item.inputPrompt,
        output: item.outputContent,
        generationId: item.id,
      });
    }
  }

  return unlinked.length;
}

export { buildTitle };
