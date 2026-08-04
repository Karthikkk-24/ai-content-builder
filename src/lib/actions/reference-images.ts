"use server";

import { auth } from "@clerk/nextjs/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { referenceImages } from "@/lib/db/schema";

/**
 * Server action: list the signed-in user's previously uploaded reference
 * images so the generator UI can offer "reuse from history" instead of
 * requiring a fresh upload every time.
 */
export async function listUserReferenceImages(limit = 12) {
  const { userId } = await auth();
  if (!userId) return [];

  const rows = await db
    .select({
      id: referenceImages.id,
      url: referenceImages.url,
      fileName: referenceImages.fileName,
      createdAt: referenceImages.createdAt,
    })
    .from(referenceImages)
    .where(eq(referenceImages.userId, userId))
    .orderBy(desc(referenceImages.createdAt))
    .limit(limit);

  return rows;
}
