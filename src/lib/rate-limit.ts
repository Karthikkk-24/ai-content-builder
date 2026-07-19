import { getRedis } from "@/lib/redis";

const WINDOW_SECONDS = 60;
const MAX_REQUESTS = 20;

const memoryRateLimit = new Map<string, { count: number; resetAt: number }>();

export async function checkRateLimit(userId: string): Promise<boolean> {
  const key = `ratelimit:${userId}`;

  try {
    const redis = getRedis();
    const count = await redis.incr(key);

    if (count === 1) {
      await redis.expire(key, WINDOW_SECONDS);
    }

    return count <= MAX_REQUESTS;
  } catch {
    const now = Date.now();
    const entry = memoryRateLimit.get(userId);

    if (!entry || now > entry.resetAt) {
      memoryRateLimit.set(userId, {
        count: 1,
        resetAt: now + WINDOW_SECONDS * 1000,
      });
      return true;
    }

    if (entry.count >= MAX_REQUESTS) {
      return false;
    }

    entry.count += 1;
    return true;
  }
}

export function rateLimitResponse(requestId?: string) {
  return Response.json(
    {
      error: {
        code: "RATE_LIMITED",
        message: "Rate limit exceeded. Please wait a minute and try again.",
        request_id: requestId ?? "req_ratelimit",
      },
    },
    {
      status: 429,
      headers: requestId ? { "x-request-id": requestId } : undefined,
    }
  );
}
