import { auth, clerkClient } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import {
  apiError,
  apiSuccess,
  getRequestId,
  logAction,
} from "@/lib/api/response";
import {
  AI_JSON_BODY_LIMIT_BYTES,
  jsonBodyErrorResponse,
  readJsonBody,
} from "@/lib/api/read-json";
import { cacheDel, invalidateUserCache, userCacheKeys } from "@/lib/cache";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { deleteUserUploadthingFiles } from "@/lib/uploadthing-files";
import { denyIfRateLimited } from "@/lib/rate-limit";

const deleteSchema = z.object({
  confirmation: z.literal("DELETE MY ACCOUNT"),
});

export async function DELETE(req: Request) {
  const requestId = getRequestId(req);

  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("UNAUTHORIZED", "Unauthorized", 401, requestId, {
        action: "account.delete",
      });
    }

    const limited = await denyIfRateLimited(userId, "account-delete", requestId);
    if (limited) return limited;

    const rawBody = await readJsonBody(req, AI_JSON_BODY_LIMIT_BYTES);
    if (!rawBody.ok) {
      return jsonBodyErrorResponse(rawBody, requestId);
    }

    const parsed = deleteSchema.safeParse(rawBody.data);
    if (!parsed.success) {
      return apiError(
        "INVALID_INPUT",
        'Type "DELETE MY ACCOUNT" to confirm',
        400,
        requestId,
        { action: "account.delete", userId }
      );
    }

    // Purge blobs while URL rows still exist. Clerk delete may fire
    // user.deleted concurrently; the webhook also purges before cascade.
    await deleteUserUploadthingFiles(userId);

    // Delete Clerk user first; webhook also cascades DB rows if it arrives.
    // We still delete local rows so data is gone even if the webhook is delayed.
    const client = await clerkClient();
    await client.users.deleteUser(userId);

    await db.delete(users).where(eq(users.id, userId));

    const keys = userCacheKeys(userId);
    await invalidateUserCache(userId);
    await cacheDel(keys.synced, keys.profile, keys.session);

    logAction({
      requestId,
      action: "account.delete",
      userId,
      outcome: "success",
    });

    return apiSuccess({ deleted: true }, requestId);
  } catch (error) {
    console.error("Failed to delete account:", error);
    return apiError(
      "INTERNAL_ERROR",
      "Failed to delete account",
      500,
      requestId,
      { action: "account.delete" }
    );
  }
}
