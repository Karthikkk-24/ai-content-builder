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

  async incr(key: string): Promise<number> {
    const current = (await this.get<number>(key)) ?? 0;
    const next = current + 1;
    const entry = memoryStore.get(key);
    const ttlMs = entry ? entry.expiresAt - Date.now() : 60_000;
    await this.set(key, next, { ex: Math.max(1, Math.ceil(ttlMs / 1000)) });
    return next;
  }

  async expire(key: string, seconds: number) {
    const entry = memoryStore.get(key);
    if (!entry) return;
    entry.expiresAt = Date.now() + seconds * 1000;
  }
}

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
