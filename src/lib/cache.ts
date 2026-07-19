import { getRedis } from "@/lib/redis";

export const CACHE_TTL = {
  USER_SYNC: 60 * 60,
  USER_PROFILE: 15 * 60,
  DASHBOARD_STATS: 2 * 60,
  GENERATIONS: 2 * 60,
  SESSION: 30 * 24 * 60 * 60,
} as const;

export const GENERATIONS_CACHE_LIMITS = [20, 50] as const;

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    return await getRedis().get<T>(key);
  } catch {
    return null;
  }
}

export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds: number
) {
  try {
    await getRedis().set(key, value, { ex: ttlSeconds });
  } catch {
    // Cache writes are best-effort.
  }
}

export async function cacheDel(...keys: string[]) {
  try {
    if (keys.length === 0) return;
    await getRedis().del(...keys);
  } catch {
    // Cache invalidation is best-effort.
  }
}

export function userCacheKeys(userId: string) {
  return {
    synced: `user:synced:${userId}`,
    profile: `user:profile:${userId}`,
    dashboard: `dashboard:stats:${userId}`,
    generations: `user:generations:${userId}`,
    session: `session:active:${userId}`,
  };
}

export function generationsCacheKey(userId: string, limit: number) {
  return `${userCacheKeys(userId).generations}:${limit}`;
}

export async function invalidateUserCache(userId: string) {
  const keys = userCacheKeys(userId);
  const generationKeys = GENERATIONS_CACHE_LIMITS.map((limit) =>
    generationsCacheKey(userId, limit)
  );

  await cacheDel(keys.dashboard, keys.generations, ...generationKeys);
}
