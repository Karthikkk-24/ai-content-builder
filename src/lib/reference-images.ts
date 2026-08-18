import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { referenceImages } from "@/lib/db/schema";

export const DEFAULT_REFERENCE_IMAGE_LIST_LIMIT = 12;
export const MAX_REFERENCE_IMAGE_LIST_LIMIT = 24;

export type ListedReferenceImage = {
  id: string;
  url: string;
  fileName: string;
  createdAt: Date;
};

export async function listUserReferenceImages(
  userId: string,
  limit: number
): Promise<ListedReferenceImage[]> {
  const safeLimit = Math.min(
    MAX_REFERENCE_IMAGE_LIST_LIMIT,
    Math.max(1, Math.floor(limit))
  );

  return db
    .select({
      id: referenceImages.id,
      url: referenceImages.url,
      fileName: referenceImages.fileName,
      createdAt: referenceImages.createdAt,
    })
    .from(referenceImages)
    .where(eq(referenceImages.userId, userId))
    .orderBy(desc(referenceImages.createdAt))
    .limit(safeLimit);
}

/**
 * Store a new reference image and drop the oldest rows past the list cap.
 * Returns URLs of pruned rows so callers can purge Uploadthing blobs.
 */
export async function insertUserReferenceImage(
  userId: string,
  input: { url: string; fileName: string }
): Promise<{ prunedUrls: string[] }> {
  await db.insert(referenceImages).values({
    userId,
    url: input.url,
    fileName: input.fileName,
  });

  const overflow: Array<{ id: string; url: string }> = [];
  const pageSize = 200;
  for (let page = 0; page < 50; page++) {
    const rows = await db
      .select({
        id: referenceImages.id,
        url: referenceImages.url,
      })
      .from(referenceImages)
      .where(eq(referenceImages.userId, userId))
      .orderBy(desc(referenceImages.createdAt))
      .limit(pageSize)
      .offset(MAX_REFERENCE_IMAGE_LIST_LIMIT + page * pageSize);
    overflow.push(...rows);
    if (rows.length < pageSize) break;
  }

  if (overflow.length === 0) {
    return { prunedUrls: [] };
  }

  await db.delete(referenceImages).where(
    inArray(
      referenceImages.id,
      overflow.map((row) => row.id)
    )
  );

  return { prunedUrls: overflow.map((row) => row.url) };
}
