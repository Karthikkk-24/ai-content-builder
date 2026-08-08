import { Redis } from "@upstash/redis";

type MemoryEntry = { value: string; expiresAt: number };

const memoryStore = new Map<string, MemoryEntry>();
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
const MAX_MEMORY_ENTRIES = 5_000;

let cleanupStarted = false;

function purgeExpiredMemoryEntries(now = Date.now()) {
  for (const [key, entry] of memoryStore) {
    if (now > entry.expiresAt) {
      memoryStore.delete(key);
    }
  }

  // Hard cap: drop oldest-expiring entries if the map still grows too large.
  if (memoryStore.size > MAX_MEMORY_ENTRIES) {
    const sorted = [...memoryStore.entries()].sort(
      (a, b) => a[1].expiresAt - b[1].expiresAt
    );
    const toDrop = sorted.length - MAX_MEMORY_ENTRIES;
    for (let i = 0; i < toDrop; i++) {
      memoryStore.delete(sorted[i][0]);
    }
  }
}

function ensureMemoryCleanup() {
  if (cleanupStarted || typeof setInterval === "undefined") return;
  cleanupStarted = true;
  const timer = setInterval(() => purgeExpiredMemoryEntries(), CLEANUP_INTERVAL_MS);
  // Don't keep the process alive solely for cleanup (Node).
  if (typeof timer === "object" && "unref" in timer) {
    timer.unref();
  }
}

class MemoryRedis {
  constructor() {
    ensureMemoryCleanup();
  }

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
    if (memoryStore.size > MAX_MEMORY_ENTRIES) {
      purgeExpiredMemoryEntries();
    }
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
 * MemoryRedis is for local/dev only — production should configure Upstash.
 */
function createRedisClient() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (url && token) {
    return Redis.fromEnv();
  }

  if (process.env.NODE_ENV === "production") {
    console.warn(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "WARN",
        service: "ai-content-builder",
        event: "redis_fallback",
        detail:
          "UPSTASH_REDIS_REST_URL/TOKEN missing — using in-memory Redis fallback (not multi-instance safe)",
      })
    );
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

/** Test/helper: force a cleanup pass of expired in-memory entries. */
export function __purgeMemoryRedisForTests() {
  purgeExpiredMemoryEntries();
}

export function __memoryRedisSizeForTests() {
  return memoryStore.size;
}

export function __seedMemoryRedisForTests(
  key: string,
  value: unknown,
  expiresAt: number
) {
  memoryStore.set(key, { value: JSON.stringify(value), expiresAt });
}
