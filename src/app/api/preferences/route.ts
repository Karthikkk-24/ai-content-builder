import { auth } from "@clerk/nextjs/server";
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
import { cacheDel, userCacheKeys } from "@/lib/cache";
import { ensureUser } from "@/lib/db/users";
import {
  PREFERENCE_GENERATION_TYPES,
  PREFERENCE_TONES,
  getUserPreferences,
  upsertUserPreferences,
} from "@/lib/preferences";
import { assertSafeExternalImageUrl } from "@/lib/safe-url";
import {
  collectUploadthingKeysFromSources,
  deleteUnreferencedUploadthingKeys,
} from "@/lib/uploadthing-files";

const updateSchema = z.object({
  defaultTone: z.union([z.enum(PREFERENCE_TONES), z.null()]).optional(),
  defaultGenerationType: z
    .union([z.enum(PREFERENCE_GENERATION_TYPES), z.null()])
    .optional(),
  marketingOptOut: z.boolean().optional(),
  customAvatarUrl: z.union([z.string().url().max(2000), z.null()]).optional(),
});

export async function GET(req: Request) {
  const requestId = getRequestId(req);

  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("UNAUTHORIZED", "Unauthorized", 401, requestId, {
        action: "preferences.get",
      });
    }

    await ensureUser(userId);
    const preferences = await getUserPreferences(userId);
    return apiSuccess(preferences, requestId);
  } catch (error) {
    console.error("Failed to load preferences:", error);
    return apiError(
      "INTERNAL_ERROR",
      "Failed to load preferences",
      500,
      requestId,
      { action: "preferences.get" }
    );
  }
}

export async function PATCH(req: Request) {
  const requestId = getRequestId(req);

  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("UNAUTHORIZED", "Unauthorized", 401, requestId, {
        action: "preferences.patch",
      });
    }

    await ensureUser(userId);

    const rawBody = await readJsonBody(req, AI_JSON_BODY_LIMIT_BYTES);
    if (!rawBody.ok) {
      return jsonBodyErrorResponse(rawBody, requestId);
    }

    const parsed = updateSchema.safeParse(rawBody.data);
    if (!parsed.success) {
      return apiError(
        "INVALID_INPUT",
        "Invalid preferences payload",
        400,
        requestId,
        { action: "preferences.patch", userId }
      );
    }

    if (parsed.data.customAvatarUrl) {
      const safe = assertSafeExternalImageUrl(parsed.data.customAvatarUrl);
      if (!safe.ok) {
        return apiError("INVALID_INPUT", safe.reason, 400, requestId, {
          action: "preferences.patch",
          userId,
        });
      }
    }

    const previous = await getUserPreferences(userId);
    const preferences = await upsertUserPreferences(userId, parsed.data);
    await cacheDel(userCacheKeys(userId).profile);

    if (parsed.data.customAvatarUrl !== undefined) {
      await deleteUnreferencedUploadthingKeys(
        userId,
        collectUploadthingKeysFromSources({
          urls: [previous.customAvatarUrl],
        })
      );
    }

    logAction({
      requestId,
      action: "preferences.patch",
      userId,
      outcome: "success",
    });

    return apiSuccess(preferences, requestId);
  } catch (error) {
    console.error("Failed to update preferences:", error);
    return apiError(
      "INTERNAL_ERROR",
      "Failed to update preferences",
      500,
      requestId,
      { action: "preferences.patch" }
    );
  }
}
