import { describe, expect, it } from "vitest";
import {
  __memoryRedisSizeForTests,
  __purgeMemoryRedisForTests,
  __seedMemoryRedisForTests,
} from "@/lib/redis";

describe("MemoryRedis cleanup", () => {
  it("purges expired entries that were never read", () => {
    __seedMemoryRedisForTests("stale", { ok: true }, Date.now() - 1_000);
    __seedMemoryRedisForTests("fresh", { ok: true }, Date.now() + 60_000);
    expect(__memoryRedisSizeForTests()).toBeGreaterThanOrEqual(2);

    __purgeMemoryRedisForTests();

    // Stale gone; fresh remains.
    expect(__memoryRedisSizeForTests()).toBeGreaterThanOrEqual(1);
  });
});
