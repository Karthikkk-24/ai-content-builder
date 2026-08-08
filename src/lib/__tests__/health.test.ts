import { beforeEach, describe, expect, it, vi } from "vitest";

const execute = vi.fn();
const redisSet = vi.fn();
const redisGet = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    execute: (...args: unknown[]) => execute(...args),
  },
}));

vi.mock("@/lib/redis", () => ({
  getRedis: () => ({
    set: (...args: unknown[]) => redisSet(...args),
    get: (...args: unknown[]) => redisGet(...args),
  }),
  isRedisConfigured: () => true,
}));

describe("health checks", () => {
  beforeEach(() => {
    execute.mockReset();
    redisSet.mockReset();
    redisGet.mockReset();
  });

  it("checkDatabase succeeds on SELECT 1", async () => {
    execute.mockResolvedValueOnce([{ "?column?": 1 }]);
    const { checkDatabase } = await import("@/lib/health");
    const result = await checkDatabase();
    expect(result.ok).toBe(true);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("checkDatabase fails when db throws", async () => {
    execute.mockRejectedValueOnce(new Error("connection refused"));
    const { checkDatabase } = await import("@/lib/health");
    const result = await checkDatabase();
    expect(result.ok).toBe(false);
    expect(result.detail).toMatch(/connection refused/);
  });

  it("checkRedis succeeds when set/get works", async () => {
    redisSet.mockResolvedValueOnce("OK");
    redisGet.mockResolvedValueOnce({ t: 1 });
    const { checkRedis } = await import("@/lib/health");
    const result = await checkRedis();
    expect(result.ok).toBe(true);
  });

  it("checkRedis fails when get returns empty", async () => {
    redisSet.mockResolvedValueOnce("OK");
    redisGet.mockResolvedValueOnce(null);
    const { checkRedis } = await import("@/lib/health");
    const result = await checkRedis();
    expect(result.ok).toBe(false);
  });
});
