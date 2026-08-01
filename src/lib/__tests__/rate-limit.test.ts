import { beforeEach, describe, expect, it, vi } from "vitest";

const mockEval = vi.fn();

vi.mock("@/lib/redis", () => ({
  getRedis: () => ({
    eval: mockEval,
  }),
  isRedisConfigured: () => true,
}));

describe("checkRateLimit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

    const { checkRateLimit } = await import("@/lib/rate-limit");
    const result = await checkRateLimit("user_1", "tweet");
    // In dev the in-memory fallback should allow the request through
    expect(result.allowed).toBe(true);
  });

  it("kills request in production when Redis errors", async () => {
    mockEval.mockRejectedValue(new Error("Redis connection failed"));
    const originalEnv = process.env.NODE_ENV;
    vi.stubEnv("NODE_ENV", "production");

    try {
      vi.resetModules();
      const { checkRateLimit } = await import("@/lib/rate-limit");
      const result = await checkRateLimit("user_1", "tweet");
      expect(result.allowed).toBe(false);
      expect(result.retryAfterSeconds).toBe(60);
    } finally {
      vi.stubEnv("NODE_ENV", originalEnv);
    }
  });
});
