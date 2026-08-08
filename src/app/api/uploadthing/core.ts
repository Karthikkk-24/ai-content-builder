import { createUploadthing, type FileRouter } from "uploadthing/next";
import { auth } from "@clerk/nextjs/server";
import { cacheDel, userCacheKeys } from "@/lib/cache";
import { db } from "@/lib/db";
import { referenceImages } from "@/lib/db/schema";
import { upsertUserPreferences } from "@/lib/preferences";

const f = createUploadthing();

const REFERENCE_IMAGE_MAX_SIZE_MB = 4;
const REFERENCE_IMAGE_MAX_COUNT = 1;
const AVATAR_IMAGE_MAX_SIZE_MB = 2;

export const uploadRouter = {
  referenceImage: f({
    image: {
      maxFileSize: `${REFERENCE_IMAGE_MAX_SIZE_MB}MB`,
      maxFileCount: REFERENCE_IMAGE_MAX_COUNT,
    },
  })
    .middleware(async () => {
      const { userId } = await auth();
      if (!userId) {
        throw new Error("Unauthorized");
      }
      return { userId };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      try {
        await db.insert(referenceImages).values({
          userId: metadata.userId,
          url: file.ufsUrl,
          fileName: file.name,
        });
      } catch (error) {
        console.error(
          "Failed to persist reference image metadata:",
          error
        );
      }

      return {
        uploadedBy: metadata.userId,
        url: file.ufsUrl,
      };
    }),

  avatarImage: f({
    image: {
      maxFileSize: `${AVATAR_IMAGE_MAX_SIZE_MB}MB`,
      maxFileCount: 1,
    },
  })
    .middleware(async () => {
      const { userId } = await auth();
      if (!userId) {
        throw new Error("Unauthorized");
      }
      return { userId };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      try {
        await upsertUserPreferences(metadata.userId, {
          customAvatarUrl: file.ufsUrl,
        });
        await cacheDel(userCacheKeys(metadata.userId).profile);
      } catch (error) {
        console.error("Failed to persist custom avatar:", error);
      }

      return {
        uploadedBy: metadata.userId,
        url: file.ufsUrl,
      };
    }),
} satisfies FileRouter;

export type UploadRouter = typeof uploadRouter;
