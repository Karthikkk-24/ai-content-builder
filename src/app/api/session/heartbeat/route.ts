import { auth } from "@clerk/nextjs/server";
import { apiError, apiSuccess, getRequestId } from "@/lib/api/response";
import { touchUserSession } from "@/lib/session";

export async function POST(req: Request) {
  const requestId = getRequestId(req);

  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("UNAUTHORIZED", "Unauthorized", 401, requestId);
    }

    await touchUserSession(userId);

    return apiSuccess({ ok: true }, requestId);
  } catch {
    return apiError(
      "INTERNAL_ERROR",
      "Session heartbeat failed",
      500,
      requestId
    );
  }
}
