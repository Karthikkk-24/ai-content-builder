import { eq } from "drizzle-orm";
import { getRedis, isRedisConfigured } from "@/lib/redis";
import { apiError, logSecurityEvent } from "@/lib/api/response";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

/**
 * Rate limiting.
 *
 * - Per-endpoint sliding windows (text, image and prompt-upgrade routes get
 *   different buckets so cheap and expensive operations throttle
 *   independently).
 * - Per-user plan tier multiplies the base route limit (`users.tier`:
 *   free=1x, pro=3x, enterprise=10x). Tiers default to `free` and are
 *   assigned out-of-band (SQL / billing) — not via a public API.
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
  export: { maxRequests: 5 },
  default: { maxRequests: 20 },
};

/** Seconds in the sliding rate-limit window (not a daily quota). */
export const RATE_LIMIT_WINDOW_SECONDS = WINDOW_SECONDS;

/** Base free-tier caps exposed for accurate Settings/docs copy. */
export function getRateLimitRulesSummary(): Array<{
  route: string;
  maxRequests: number;
  windowSeconds: number;
}> {
  return Object.entries(ROUTE_RULES).map(([route, rule]) => ({
    route,
    maxRequests: rule.maxRequests,
    windowSeconds: WINDOW_SECONDS,
  }));
}

export const USER_TIERS = ["free", "pro", "enterprise"] as const;
export type UserTier = (typeof USER_TIERS)[number];

/** Multipliers applied to each route's base `maxRequests`. */
export const TIER_LIMIT_MULTIPLIER: Record<UserTier, number> = {
  free: 1,
  pro: 3,
  enterprise: 10,
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
const MEMORY_WINDOW_CLEANUP_MS = 5 * 60 * 1000;
let memoryWindowCleanupStarted = false;

const tierCache = new Map<string, { tier: UserTier; expiresAt: number }>();
const TIER_CACHE_TTL_MS = 60_000;

function ensureMemoryWindowCleanup() {
  if (memoryWindowCleanupStarted || typeof setInterval === "undefined") return;
  memoryWindowCleanupStarted = true;
  const timer = setInterval(() => {
    const nowMs = Date.now();
    const cutoff = nowMs - WINDOW_SECONDS * 1000;
    for (const [key, timestamps] of memoryWindows) {
      const kept = timestamps.filter((ts) => ts > cutoff);
      if (kept.length === 0) {
        memoryWindows.delete(key);
      } else {
        memoryWindows.set(key, kept);
      }
    }
  }, MEMORY_WINDOW_CLEANUP_MS);
  if (typeof timer === "object" && "unref" in timer) {
    timer.unref();
  }
}

function getRule(route: string): { maxRequests: number } {
  return ROUTE_RULES[route] ?? ROUTE_RULES.default;
}

export function normalizeUserTier(value: string | null | undefined): UserTier {
  if (value === "pro" || value === "enterprise") return value;
  return "free";
}

export function resolveRouteMaxRequests(route: string, tier: UserTier): number {
  const base = getRule(route).maxRequests;
  return Math.max(1, Math.floor(base * TIER_LIMIT_MULTIPLIER[tier]));
}

/**
 * Load `users.tier` for rate-limit multipliers. Falls back to `free` if the
 * user row is missing or the DB is unavailable (e.g. unit tests).
 */
export async function resolveUserRateLimitTier(
  userId: string
): Promise<UserTier> {
  const cached = tierCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.tier;
  }

  try {
    const [row] = await db
      .select({ tier: users.tier })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    const tier = normalizeUserTier(row?.tier);
    tierCache.set(userId, { tier, expiresAt: Date.now() + TIER_CACHE_TTL_MS });
    return tier;
  } catch {
    return "free";
  }
}

function memorySlidingWindow(
  key: string,
  rule: { maxRequests: number }
): RateLimitResult {
  ensureMemoryWindowCleanup();
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
  route: string,
  options?: { tier?: UserTier }
): Promise<RateLimitResult> {
  const tier = options?.tier ?? (await resolveUserRateLimitTier(userId));
  const maxRequests = resolveRouteMaxRequests(route, tier);
  const rule = { maxRequests };
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

    const [allowed, retryAfter] = (await redis.eval(
      SLIDING_WINDOW_LUA,
      [key],
      [nowSeconds, WINDOW_SECONDS, maxRequests, memberPrefix]
    )) as [number, number];

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

/** Public unauthenticated probes. Kept out of user-facing Settings copy. */
const PUBLIC_ROUTE_RULES: Record<string, { maxRequests: number }> = {
  ready: { maxRequests: 30 },
  share: { maxRequests: 60 },
};

/**
 * Client key for public rate limits. Uses the first forwarded IP when present.
 * This is a throttle signal, not auth — spoofing only changes the bucket.
 */
export function clientKeyFromRequest(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const candidate =
    forwarded?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    req.headers.get("cf-connecting-ip")?.trim() ||
    "unknown";
  const sanitized = candidate.replace(/[^a-zA-Z0-9.:]/g, "").slice(0, 64);
  return sanitized || "unknown";
}

/**
 * Rate-limit public endpoints without a user id.
 *
 * Unlike AI routes, this fails over to in-memory even in production so
 * orchestrator probes keep working if Redis is down (they would otherwise
 * 429 forever via fail-closed `checkRateLimit`).
 */
export async function checkPublicRateLimit(
  clientKey: string,
  route: string
): Promise<RateLimitResult> {
  const rule = PUBLIC_ROUTE_RULES[route] ?? { maxRequests: 30 };
  const key = `ratelimit:public:${route}:${clientKey}`;

  if (!isRedisConfigured()) {
    return memorySlidingWindow(key, rule);
  }

  try {
    const redis = getRedis();
    const nowSeconds = Math.floor(Date.now() / 1000);
    const memberPrefix = `${nowSeconds}:${crypto.randomUUID()}`;

    const [allowed, retryAfter] = (await redis.eval(
      SLIDING_WINDOW_LUA,
      [key],
      [nowSeconds, WINDOW_SECONDS, rule.maxRequests, memberPrefix]
    )) as [number, number];

    return {
      allowed: allowed === 1,
      retryAfterSeconds: allowed === 1 ? 0 : retryAfter,
    };
  } catch (error) {
    console.warn("Public rate-limit Redis error, falling back to in-memory:", error);
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
