import { NextResponse } from "next/server";
import { checkDatabase, checkRedis } from "@/lib/health";
import {
  checkPublicRateLimit,
  clientKeyFromRequest,
  rateLimitResponse,
} from "@/lib/rate-limit";
import { getRequestId } from "@/lib/api/response";

/** Readiness: DB + Redis must be reachable. */
export async function GET(req: Request) {
  const requestId = getRequestId(req);
  const clientKey = clientKeyFromRequest(req);
  const rateLimit = await checkPublicRateLimit(clientKey, "ready");
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit.retryAfterSeconds, requestId);
  }

  const [database, redis] = await Promise.all([
    checkDatabase(),
    checkRedis(),
  ]);

  const ready = database.ok && redis.ok;

  return NextResponse.json(
    {
      status: ready ? "ready" : "not_ready",
      timestamp: new Date().toISOString(),
      checks: {
        database,
        redis,
      },
    },
    {
      status: ready ? 200 : 503,
      headers: {
        "Cache-Control": "no-store",
        "x-request-id": requestId,
      },
    }
  );
}
