import { auth } from "@clerk/nextjs/server";
import { apiError, apiSuccess, getRequestId } from "@/lib/api/response";
import { parseLimitParam } from "@/lib/api/parse-limit";
import { getCachedGenerations } from "@/lib/dashboard";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export async function GET(req: Request) {
  const requestId = getRequestId(req);

  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("UNAUTHORIZED", "Unauthorized", 401, requestId, {
        action: "auth",
      });
    }

    const { searchParams } = new URL(req.url);
    const limit = parseLimitParam(searchParams.get("limit"), {
      defaultLimit: DEFAULT_LIMIT,
      maxLimit: MAX_LIMIT,
    });

    const items = await getCachedGenerations(userId, limit);
    return apiSuccess(items, requestId);
  } catch (error) {
    console.error("Failed to load generations:", error);
    return apiSuccess([], requestId);
  }
}
