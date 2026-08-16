import { auth } from "@clerk/nextjs/server";
import { apiError, apiSuccess, getRequestId } from "@/lib/api/response";
import { parseLimitParam } from "@/lib/api/parse-limit";
import { ensureUser } from "@/lib/db/users";
import {
  DEFAULT_REFERENCE_IMAGE_LIST_LIMIT,
  MAX_REFERENCE_IMAGE_LIST_LIMIT,
  listUserReferenceImages,
} from "@/lib/reference-images";

export async function GET(req: Request) {
  const requestId = getRequestId(req);

  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("UNAUTHORIZED", "Unauthorized", 401, requestId, {
        action: "reference-images.list",
      });
    }

    await ensureUser(userId);

    const limit = parseLimitParam(new URL(req.url).searchParams.get("limit"), {
      defaultLimit: DEFAULT_REFERENCE_IMAGE_LIST_LIMIT,
      maxLimit: MAX_REFERENCE_IMAGE_LIST_LIMIT,
    });

    const items = await listUserReferenceImages(userId, limit);
    return apiSuccess({ items }, requestId);
  } catch (error) {
    console.error("Failed to list reference images:", error);
    return apiError(
      "INTERNAL_ERROR",
      "Failed to list reference images",
      500,
      requestId,
      { action: "reference-images.list" }
    );
  }
}
