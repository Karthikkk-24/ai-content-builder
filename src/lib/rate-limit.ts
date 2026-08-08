import { getRedis, isRedisConfigured } from "@/lib/redis";
import { apiError, logSecurityEvent } from "@/lib/api/response";

/**
 * Rate limiting.
 *
 * - Per-endpoint sliding windows (text, image and prompt-upgrade routes get
 *   different buckets so cheap and expensive operations throttle
 *   independently).
 * - Atomic check-and-record via a Lua script on Redis so concurrent
 *   requests cannot race past the limit, and a sorted-set sliding window
 *   so limit windows cannot be double-bursted at fixed-window edges.
 * - Degradation policy: local development falls back to an in-memory
 *   sliding window. Production fails closed (deny) when Redis is not
 *   configured or errors, because a silently-disabled limiter in
 *   production is worse than a brief outage.
 */

const WINDOW_SECONDS = 60;

const ROUTE_RULES: Record<string, { maxRequests: number }> = {
  tweet: { maxRequests: 20 },
  blog: { maxRequests: 10 },
  caption: { maxRequests: 20 },
  photo: { maxRequests: 5 },
  poster: { maxRequests: 5 },
  "prompt-upgrade": { maxRequests: 10 },
  default: { maxRequests: 20 },
};

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

/**
 * Lua script: sliding-window rate limit on a sorted set.
 * KEYS[1] = bucket key
 * ARGV[1] = now (seconds)
 * ARGV[2] = window size (seconds)
 * ARGV[3] = max requests
 * ARGV[4] = unique member prefix for this request
 * Returns [allowed (0|1), retryAfterSeconds]
 */
const SLIDING_WINDOW_LUA = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local max_requests = tonumber(ARGV[3])
local member_prefix = ARGV[4]

redis.call('ZREMRANGEBYSCORE', key, 0, now - window)

local count = redis.call('ZCARD', key)

if count + 1 > max_requests then
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local retry = window
  if oldest[2] ~= nil then
    retry = math.max(1, math.ceil(tonumber(oldest[2]) + window - now))
  end
  return {0, retry}
end

redis.call('ZADD', key, now, member_prefix)
redis.call('EXPIRE', key, window + 10)

return {1, 0}
`;

const memoryWindows = new Map<string, number[]>();

function getRule(route: string): { maxRequests: number } {
  return ROUTE_RULES[route] ?? ROUTE_RULES.default;
}

function memorySlidingWindow(
  key: string,
  rule: { maxRequests: number }
): RateLimitResult {
  const nowMs = Date.now();
  const windowMs = WINDOW_SECONDS * 1000;
  const cutoff = nowMs - windowMs;

  const timestamps = (memoryWindows.get(key) ?? []).filter((ts) => ts > cutoff);

  if (timestamps.length >= rule.maxRequests) {
    const oldest = timestamps[0];
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((oldest + windowMs - nowMs) / 1000)
    );
    memoryWindows.set(key, timestamps);
    return { allowed: false, retryAfterSeconds };
  }

  timestamps.push(nowMs);
  memoryWindows.set(key, timestamps);
  return { allowed: true, retryAfterSeconds: 0 };
}

export async function checkRateLimit(
  userId: string,
  route: string
): Promise<RateLimitResult> {
  const rule = getRule(route);
  const key = `ratelimit:${userId}:${route}`;

  if (!isRedisConfigured()) {
    if (process.env.NODE_ENV === "production") {
      // Fail closed: never run rate-limit-free in production.
      console.error(
        "CRITICAL: Redis is not configured; denying request to enforce rate limits in production"
      );
      return { allowed: false, retryAfterSeconds: WINDOW_SECONDS };
    }
    return memorySlidingWindow(key, rule);
  }

  try {
    const redis = getRedis();
    const nowSeconds = Math.floor(Date.now() / 1000);
    const memberPrefix = `${nowSeconds}:${crypto.randomUUID()}`;

    const [allowed, retryAfter] = await redis.eval(
      SLIDING_WINDOW_LUA,
      [key],
      [nowSeconds, WINDOW_SECONDS, rule.maxRequests, memberPrefix]
    ) as [number, number];

    return {
      allowed: allowed === 1,
      retryAfterSeconds: allowed === 1 ? 0 : retryAfter,
    };
  } catch (error) {
    if (process.env.NODE_ENV === "production") {
      // Fail closed on Redis errors in production.
      console.error("CRITICAL: rate-limit Redis error in production:", error);
      return { allowed: false, retryAfterSeconds: WINDOW_SECONDS };
    }

    console.warn("Rate-limit Redis error, falling back to in-memory:", error);
    return memorySlidingWindow(key, rule);
  }
}

export function rateLimitResponse(
  retryAfterSeconds: number,
  requestId?: string,
  userId?: string | null
) {
  const id = requestId ?? "req_ratelimit";
  const message =
    retryAfterSeconds > 0
      ? `Rate limit exceeded. Try again in ${retryAfterSeconds} seconds.`
      : "Rate limit exceeded. Please wait a moment and try again.";

  logSecurityEvent({
    type: "rate_limit",
    requestId: id,
    userId,
    action: "rate_limit",
    reason: message,
    status: 429,
    detail: `retry_after=${Math.max(1, retryAfterSeconds)}`,
  });

  const response = apiError("RATE_LIMITED", message, 429, id, {
    userId,
    action: "rate_limit",
    skipLog: true,
  });
  response.headers.set("Retry-After", String(Math.max(1, retryAfterSeconds)));
  return response;
}
