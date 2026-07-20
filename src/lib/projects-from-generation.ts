import { randomUUID } from "crypto";
import { desc, eq } from "drizzle-orm";
import { invalidateUserCache } from "@/lib/cache";
import { db } from "@/lib/db";
import type { ContentBlock } from "@/lib/db/schema";
import { contentProjects, generations } from "@/lib/db/schema";

const MAX_TITLE_LENGTH = 60;

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
}: {
  userId: string;
  type: string;
  prompt: string;
  output: string;
}): Promise<string> {
  const blocks: ContentBlock[] = [
    {
      id: randomUUID(),
      type: "heading",
      content: formatTypeLabel(type),
      level: 2,
    },
    {
      id: randomUUID(),
      type: "paragraph",
      content: output,
    },
  ];

  const [project] = await db
    .insert(contentProjects)
    .values({
      userId,
      title: buildTitle(prompt, type),
      blocks,
    })
    .returning({ id: contentProjects.id });

  await invalidateUserCache(userId);
  return project.id;
}

export async function saveImageGenerationAsProject({
  userId,
  type,
  prompt,
  imageUrl,
}: {
  userId: string;
  type: string;
  prompt: string;
  imageUrl: string;
}): Promise<string> {
  const blocks: ContentBlock[] = [
    {
      id: randomUUID(),
      type: "heading",
      content: formatTypeLabel(type),
      level: 2,
    },
    {
      id: randomUUID(),
      type: "image",
      content: prompt,
      url: imageUrl,
    },
    {
      id: randomUUID(),
      type: "paragraph",
      content: prompt,
    },
  ];

  const [project] = await db
    .insert(contentProjects)
    .values({
      userId,
      title: buildTitle(prompt, type),
      blocks,
    })
    .returning({ id: contentProjects.id });

  await invalidateUserCache(userId);
  return project.id;
}

export async function syncGenerationsToProjects(userId: string): Promise<number> {
  const existing = await db
    .select({ id: contentProjects.id })
    .from(contentProjects)
    .where(eq(contentProjects.userId, userId))
    .limit(1);

  if (existing.length > 0) {
    return 0;
  }

  const items = await db
    .select()
    .from(generations)
    .where(eq(generations.userId, userId))
    .orderBy(desc(generations.createdAt));

  if (items.length === 0) {
    return 0;
  }

  for (const item of items) {
    if (item.type === "poster" || item.type === "photo") {
      const imageUrl =
        item.outputContent.startsWith("http") ||
        item.outputContent.startsWith("data:image/")
          ? item.outputContent
          : "";

      if (!imageUrl) {
        await saveTextGenerationAsProject({
          userId,
          type: item.type,
          prompt: item.inputPrompt,
          output: item.inputPrompt,
        });
        continue;
      }

      await saveImageGenerationAsProject({
        userId,
        type: item.type,
        prompt: item.inputPrompt,
        imageUrl,
      });
    } else {
      await saveTextGenerationAsProject({
        userId,
        type: item.type,
        prompt: item.inputPrompt,
        output: item.outputContent,
      });
    }
  }

  return items.length;
}

export { buildTitle };
