import { beforeEach, describe, expect, it, vi } from "vitest";

const execute = vi.fn();
const redisSet = vi.fn();
const redisGet = vi.fn();
let redisConfigured = true;

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
  isRedisConfigured: () => redisConfigured,
}));

describe("health checks", () => {
  beforeEach(() => {
    execute.mockReset();
    redisSet.mockReset();
    redisGet.mockReset();
    redisConfigured = true;
    vi.unstubAllEnvs();
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
    expect(result.detail).toBe("Database check failed");
    expect(result.detail).not.toMatch(/connection refused/);
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

  it("checkRedis uses a generic detail when Redis throws", async () => {
    redisSet.mockRejectedValueOnce(new Error("ECONNREFUSED 127.0.0.1:6379"));
    const { checkRedis } = await import("@/lib/health");
    const result = await checkRedis();
    expect(result.ok).toBe(false);
    expect(result.detail).toBe("Redis check failed");
    expect(result.detail).not.toMatch(/ECONNREFUSED|127\.0\.0\.1/);
  });

  it("checkRedis is not ready in production without Upstash", async () => {
    redisConfigured = false;
    vi.stubEnv("NODE_ENV", "production");
    const { checkRedis } = await import("@/lib/health");
    const result = await checkRedis();
    expect(result.ok).toBe(false);
    expect(result.detail).toBe("Redis is not configured");
    expect(redisSet).not.toHaveBeenCalled();
  });
});
