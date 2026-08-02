import { describe, expect, it, vi } from "vitest";

const insertChainResolve = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    insert: () => ({
      values: insertChainResolve,
    }),
    select: () => ({
      from: () => ({
        leftJoin: () => ({
          where: () => ({
            orderBy: () => Promise.resolve([]),
          }),
        }),
      }),
    }),
  },
}));

vi.mock("@/lib/cache", () => ({
  invalidateUserCache: vi.fn(),
}));

describe("syncGenerationsToProjects", () => {
  it("returns 0 when no unlinked generations exist", async () => {
    insertChainResolve.mockResolvedValue([]);

    const { syncGenerationsToProjects } = await import(
      "@/lib/projects-from-generation"
    );

    const result = await syncGenerationsToProjects("user_empty");

    expect(result).toBe(0);
  });
});
