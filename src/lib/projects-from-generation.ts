import { randomUUID } from "crypto";
import { desc, eq } from "drizzle-orm";
import { invalidateUserCache } from "@/lib/cache";
import { db } from "@/lib/db";
import type { ContentBlock } from "@/lib/db/schema";
import { contentProjects, generations } from "@/lib/db/schema";

function buildTitle(prompt: string, type: string) {
  const trimmed = prompt.trim();
  if (!trimmed) return `${type} draft`;
  return trimmed.length > 60 ? `${trimmed.slice(0, 57)}...` : trimmed;
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
}) {
  const title = buildTitle(prompt, type);
  const blocks: ContentBlock[] = [
    {
      id: randomUUID(),
      type: "heading",
      content: type.replace("_", " "),
      level: 2,
    },
    {
      id: randomUUID(),
      type: "paragraph",
      content: output,
    },
  ];

  await db.insert(contentProjects).values({
    userId,
    title,
    blocks,
  });

  await invalidateUserCache(userId);
}

export async function saveImageGenerationAsProject({
  userId,
  type,
  prompt,
}: {
  userId: string;
  type: string;
  prompt: string;
}) {
  const title = buildTitle(prompt, type);
  const blocks: ContentBlock[] = [
    {
      id: randomUUID(),
      type: "heading",
      content: type.replace("_", " "),
      level: 2,
    },
    {
      id: randomUUID(),
      type: "paragraph",
      content: prompt,
    },
  ];

  await db.insert(contentProjects).values({
    userId,
    title,
    blocks,
  });

  await invalidateUserCache(userId);
}

export async function syncGenerationsToProjects(userId: string) {
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
      await saveImageGenerationAsProject({
        userId,
        type: item.type,
        prompt: item.inputPrompt,
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
