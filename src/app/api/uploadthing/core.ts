import { createUploadthing, type FileRouter } from "uploadthing/next";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { referenceImages } from "@/lib/db/schema";
import { ensureUser } from "@/lib/db/users";

const f = createUploadthing();

export const ourFileRouter = {
  referenceImage: f({
    image: { maxFileSize: "4MB", maxFileCount: 1 },
  })
    .middleware(async () => {
      const { userId } = await auth();
      if (!userId) throw new Error("Unauthorized");
      return { userId };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      await ensureUser(metadata.userId);

      await db.insert(referenceImages).values({
        userId: metadata.userId,
        url: file.ufsUrl,
        fileName: file.name,
      });

      return { url: file.ufsUrl, fileName: file.name, userId: metadata.userId };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
