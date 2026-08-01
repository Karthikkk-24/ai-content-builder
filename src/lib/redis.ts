import { Redis } from "@upstash/redis";

type MemoryEntry = { value: string; expiresAt: number };

const memoryStore = new Map<string, MemoryEntry>();

class MemoryRedis {
  async get<T>(key: string): Promise<T | null> {
    const entry = memoryStore.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      memoryStore.delete(key);
      return null;
    }
    return JSON.parse(entry.value) as T;
  }

  async set(key: string, value: unknown, options?: { ex?: number }) {
    const ttl = options?.ex ?? 3600;
    memoryStore.set(key, {
      value: JSON.stringify(value),
      expiresAt: Date.now() + ttl * 1000,
    });
  }

  async del(...keys: string[]) {
    keys.forEach((key) => memoryStore.delete(key));
  }
}

/**
 * Returns the Upstash Redis client when UPSTASH_REDIS_REST_URL/TOKEN are set,
 * otherwise returns an in-memory stand-in for local development.
 *
 * NOTE: The fallback only implements the SUBSET of the Redis API used by
 * cache.ts (get/set/del). Callers like rate-limit.ts MUST short-circuit via
 * `isRedisConfigured()` before attempting Redis-only commands (eval, zadd...).
 */
function createRedisClient() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (url && token) {
    return Redis.fromEnv();
  }

  return new MemoryRedis() as unknown as Redis;
}

let _redis: Redis | null = null;

export function getRedis() {
  if (!_redis) {
    _redis = createRedisClient();
  }
  return _redis;
}

export function isRedisConfigured() {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  );
}
