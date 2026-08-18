import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCacheGet = vi.fn();
const mockCacheSet = vi.fn();

vi.mock("@/lib/cache", () => ({
  CACHE_TTL: { SESSION: 31 * 24 * 60 * 60, USER_PROFILE: 15 * 60 },
  cacheGet: (...args: unknown[]) => mockCacheGet(...args),
  cacheSet: (...args: unknown[]) => mockCacheSet(...args),
  userCacheKeys: (userId: string) => ({
    session: `session:active:${userId}`,
    profile: `user:profile:${userId}`,
  }),
}));

vi.mock("@/lib/clerk-config", () => ({
  clerkConfig: { sessionMaxAgeDays: 30 },
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
}));

vi.mock("@/lib/preferences", () => ({
  getUserPreferences: vi.fn(),
}));

import {
  getSessionStatus,
  getUserSessionActivity,
  isSessionWithinMaxAge,
  touchUserSession,
} from "@/lib/session";

describe("session activity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("isSessionWithinMaxAge respects the configured window", () => {
    const now = 1_000_000_000_000;
    const dayMs = 24 * 60 * 60 * 1000;
    expect(isSessionWithinMaxAge(now - 29 * dayMs, now)).toBe(true);
    expect(isSessionWithinMaxAge(now - 31 * dayMs, now)).toBe(false);
  });

  it("getUserSessionActivity returns null for missing or invalid payloads", async () => {
    mockCacheGet.mockResolvedValueOnce(null);
    expect(await getUserSessionActivity("u1")).toBeNull();

    mockCacheGet.mockResolvedValueOnce({ activeAt: "bad" });
    expect(await getUserSessionActivity("u1")).toBeNull();
  });

  it("getUserSessionActivity returns a valid stamp", async () => {
    mockCacheGet.mockResolvedValueOnce({ activeAt: 42 });
    await expect(getUserSessionActivity("u1")).resolves.toEqual({
      activeAt: 42,
    });
    expect(mockCacheGet).toHaveBeenCalledWith("session:active:u1");
  });

  it("touchUserSession writes activeAt with SESSION TTL", async () => {
    mockCacheSet.mockResolvedValueOnce(undefined);
    const before = Date.now();
    const result = await touchUserSession("u1");
    const after = Date.now();

    expect(result.activeAt).toBeGreaterThanOrEqual(before);
    expect(result.activeAt).toBeLessThanOrEqual(after);
    expect(mockCacheSet).toHaveBeenCalledWith(
      "session:active:u1",
      { activeAt: result.activeAt },
      31 * 24 * 60 * 60
    );
  });

  it("getSessionStatus reports isActive from Redis stamp", async () => {
    mockCacheGet.mockResolvedValueOnce({ activeAt: Date.now() });
    await expect(getSessionStatus("u1")).resolves.toMatchObject({
      maxAgeDays: 30,
      isActive: true,
    });

    mockCacheGet.mockResolvedValueOnce(null);
    await expect(getSessionStatus("u1")).resolves.toEqual({
      activeAt: null,
      maxAgeDays: 30,
      isActive: false,
    });
  });
});

describe("shouldSignOutIdleSession", () => {
  it("signs out only when a stamp exists and is idle", async () => {
    const { shouldSignOutIdleSession } = await import("@/lib/session-idle");
    expect(
      shouldSignOutIdleSession({ activeAt: null, isActive: false })
    ).toBe(false);
    expect(
      shouldSignOutIdleSession({ activeAt: Date.now(), isActive: true })
    ).toBe(false);
    expect(
      shouldSignOutIdleSession({ activeAt: 1, isActive: false })
    ).toBe(true);
  });
});
