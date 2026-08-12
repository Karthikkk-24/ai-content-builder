import { auth } from "@clerk/nextjs/server";
import { apiError, apiSuccess, getRequestId } from "@/lib/api/response";
import { clerkConfig } from "@/lib/clerk-config";
import { getSessionStatus, touchUserSession } from "@/lib/session";

/** Read last Redis activity stamp (does not refresh TTL). */
export async function GET(req: Request) {
  const requestId = getRequestId(req);

  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("UNAUTHORIZED", "Unauthorized", 401, requestId, {
        action: "auth",
      });
    }

    const status = await getSessionStatus(userId);
    return apiSuccess(status, requestId);
  } catch {
    return apiError(
      "INTERNAL_ERROR",
      "Failed to read session status",
      500,
      requestId
    );
  }
}

/** Refresh Redis activity + TTL; keep Clerk warm via SessionKeeper's getToken(). */
export async function POST(req: Request) {
  const requestId = getRequestId(req);

  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("UNAUTHORIZED", "Unauthorized", 401, requestId, {
        action: "auth",
      });
    }

    const activity = await touchUserSession(userId);

    return apiSuccess(
      {
        ok: true as const,
        activeAt: activity.activeAt,
        maxAgeDays: clerkConfig.sessionMaxAgeDays,
        isActive: true as const,
      },
      requestId
    );
  } catch {
    return apiError(
      "INTERNAL_ERROR",
      "Session heartbeat failed",
      500,
      requestId
    );
  }
}
