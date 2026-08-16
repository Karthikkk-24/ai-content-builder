import { desc, eq } from "drizzle-orm";
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
