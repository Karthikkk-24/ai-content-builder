import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCacheGet = vi.fn();
const mockCacheSet = vi.fn();
const mockTouchUserSession = vi.fn();
const mockCurrentUser = vi.fn();
const mockLimit = vi.fn();
const mockWhere = vi.fn();
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockUpdateSet = vi.fn();
const mockUpdateWhere = vi.fn();
const mockValues = vi.fn();

vi.mock("@/lib/cache", () => ({
  cacheGet: (...args: unknown[]) => mockCacheGet(...args),
  cacheSet: (...args: unknown[]) => mockCacheSet(...args),
  CACHE_TTL: { USER_SYNC: 60 },
  userCacheKeys: (userId: string) => ({ synced: `user:synced:${userId}` }),
}));

vi.mock("@/lib/session", () => ({
  touchUserSession: (...args: unknown[]) => mockTouchUserSession(...args),
}));

vi.mock("@clerk/nextjs/server", () => ({
  currentUser: () => mockCurrentUser(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
    insert: (...args: unknown[]) => mockInsert(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
  },
}));

describe("ensureUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCacheGet.mockResolvedValue(null);
    mockCacheSet.mockResolvedValue(undefined);
    mockTouchUserSession.mockResolvedValue(undefined);

    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({ limit: mockLimit });

    mockInsert.mockReturnValue({ values: mockValues });
    mockValues.mockResolvedValue(undefined);

    mockUpdate.mockReturnValue({ set: mockUpdateSet });
    mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });
    mockUpdateWhere.mockResolvedValue(undefined);
  });

  it("does not overwrite an existing email with @clerk.local when Clerk is missing", async () => {
    mockCurrentUser.mockResolvedValue(null);
    mockLimit.mockResolvedValue([{ id: "user_1", email: "real@example.com" }]);

    const { ensureUser } = await import("@/lib/db/users");
    await ensureUser("user_1");

    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockCacheSet).toHaveBeenCalled();
  });

  it("inserts a synthetic email only for brand-new users", async () => {
    mockCurrentUser.mockResolvedValue(null);
    mockLimit.mockResolvedValue([]);

    const { ensureUser } = await import("@/lib/db/users");
    await ensureUser("user_new");

    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "user_new",
        email: "user_new@clerk.local",
      })
    );
  });

  it("updates email when Clerk returns a primary address", async () => {
    mockCurrentUser.mockResolvedValue({
      primaryEmailAddress: { emailAddress: "fresh@example.com" },
      emailAddresses: [],
      firstName: "A",
      lastName: "B",
      imageUrl: "https://img.clerk.com/x",
    });
    mockLimit.mockResolvedValue([{ id: "user_1", email: "old@example.com" }]);

    const { ensureUser } = await import("@/lib/db/users");
    await ensureUser("user_1");

    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "fresh@example.com",
        name: "A B",
        avatarUrl: "https://img.clerk.com/x",
      })
    );
  });
});
