import { createUploadthing, type FileRouter } from "uploadthing/next";
import { auth } from "@clerk/nextjs/server";
import { cacheDel, userCacheKeys } from "@/lib/cache";
import { getUserPreferences, upsertUserPreferences } from "@/lib/preferences";
import { insertUserReferenceImage } from "@/lib/reference-images";
import {
  collectUploadthingKeysFromSources,
  deleteUnreferencedUploadthingKeys,
} from "@/lib/uploadthing-files";
import { persistUploadMetadata } from "@/lib/uploadthing-persist";

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
      const { prunedUrls } = await persistUploadMetadata(file.key, async () =>
        insertUserReferenceImage(metadata.userId, {
          url: file.ufsUrl,
          fileName: file.name,
        })
      );

      await deleteUnreferencedUploadthingKeys(
        metadata.userId,
        collectUploadthingKeysFromSources({ urls: prunedUrls })
      );

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
      const previousUrl = await persistUploadMetadata(file.key, async () => {
        const current = await getUserPreferences(metadata.userId);
        await upsertUserPreferences(metadata.userId, {
          customAvatarUrl: file.ufsUrl,
        });
        await cacheDel(userCacheKeys(metadata.userId).profile);
        return current.customAvatarUrl;
      });

      await deleteUnreferencedUploadthingKeys(
        metadata.userId,
        collectUploadthingKeysFromSources({ urls: [previousUrl] })
      );

      return {
        uploadedBy: metadata.userId,
        url: file.ufsUrl,
      };
    }),
} satisfies FileRouter;

export type UploadRouter = typeof uploadRouter;
