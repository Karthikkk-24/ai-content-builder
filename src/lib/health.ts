import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { getRedis, isRedisConfigured } from "@/lib/redis";

export type HealthCheckResult = {
  ok: boolean;
  latencyMs: number;
  detail?: string;
};

export async function checkDatabase(): Promise<HealthCheckResult> {
  const started = Date.now();
  try {
    await db.execute(sql`SELECT 1`);
    return { ok: true, latencyMs: Date.now() - started };
  } catch (error) {
    console.error("Health database check failed:", error);
    return {
      ok: false,
      latencyMs: Date.now() - started,
      detail: "Database check failed",
    };
  }
}

export async function checkRedis(): Promise<HealthCheckResult> {
  const started = Date.now();
  try {
    const redis = getRedis();
    const key = "health:ready:ping";
    await redis.set(key, { t: Date.now() }, { ex: 30 });
    const value = await redis.get(key);
    if (value == null) {
      return {
        ok: false,
        latencyMs: Date.now() - started,
        detail: "Redis set/get returned empty",
      };
    }
    return {
      ok: true,
      latencyMs: Date.now() - started,
      detail: isRedisConfigured() ? "upstash" : "memory-fallback",
    };
  } catch (error) {
    console.error("Health redis check failed:", error);
    return {
      ok: false,
      latencyMs: Date.now() - started,
      detail: "Redis check failed",
    };
  }
}
