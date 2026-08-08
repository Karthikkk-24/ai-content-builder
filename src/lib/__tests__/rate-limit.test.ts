import { beforeEach, describe, expect, it, vi } from "vitest";

const mockEval = vi.fn();
let redisConfigured = true;

vi.mock("@/lib/redis", () => ({
  getRedis: () => ({
    eval: mockEval,
  }),
  isRedisConfigured: () => redisConfigured,
}));

describe("checkRateLimit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redisConfigured = true;
    vi.unstubAllEnvs();
  });

  it("allows the first request and reports success", async () => {
    mockEval.mockResolvedValue([1, 0]);

    const { checkRateLimit } = await import("@/lib/rate-limit");
    const result = await checkRateLimit("user_1", "tweet");
    expect(result.allowed).toBe(true);
    expect(result.retryAfterSeconds).toBe(0);
  });

  it("denies with retryAfter when over the limit", async () => {
    mockEval.mockResolvedValue([0, 30]);

    const { checkRateLimit } = await import("@/lib/rate-limit");
    const result = await checkRateLimit("user_1", "photo");
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBe(30);
  });

  it("uses stricter image limits than text limits", async () => {
    mockEval.mockResolvedValue([1, 0]);

    const { checkRateLimit } = await import("@/lib/rate-limit");
    await checkRateLimit("user_1", "photo");
    await checkRateLimit("user_1", "tweet");

    const [photoScript, photoKeys, photoArgv] = mockEval.mock.calls[0];
    const [tweetScript, tweetKeys, tweetArgv] = mockEval.mock.calls[1];

    expect(photoScript).toBe(tweetScript); // Same sliding window logic
    expect(photoKeys[0]).toContain(":photo");
    expect(tweetKeys[0]).toContain(":tweet");
    expect(photoArgv[2]).toBeLessThan(tweetArgv[2]); // maxRequests lower for photo
  });

  it("falls back to in-memory limiting in development when Redis errors", async () => {
    mockEval.mockRejectedValue(new Error("Redis connection failed"));
    vi.stubEnv("NODE_ENV", "development");

    const { checkRateLimit } = await import("@/lib/rate-limit");
    const result = await checkRateLimit("user_dev_fallback", "tweet");
    expect(result.allowed).toBe(true);
  });

  it("memory limiter allows up to the route max then denies", async () => {
    redisConfigured = false;
    vi.stubEnv("NODE_ENV", "development");

    const { checkRateLimit } = await import("@/lib/rate-limit");
    for (let i = 0; i < 20; i++) {
      const allowed = await checkRateLimit("mem_user_boundary", "tweet");
      expect(allowed.allowed).toBe(true);
    }
    const denied = await checkRateLimit("mem_user_boundary", "tweet");
    expect(denied.allowed).toBe(false);
    expect(denied.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("kills request in production when Redis errors", async () => {
    mockEval.mockRejectedValue(new Error("Redis connection failed"));
    vi.stubEnv("NODE_ENV", "production");

    const { checkRateLimit } = await import("@/lib/rate-limit");
    const result = await checkRateLimit("user_prod", "tweet");
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBe(60);
  });
});
