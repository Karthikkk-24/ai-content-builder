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
            orderBy: () => ({
              limit: () => Promise.resolve([]),
            }),
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

  it("caps each list-triggered sync so GET /api/projects stays bounded", async () => {
    const { SYNC_GENERATIONS_TO_PROJECTS_BATCH } = await import(
      "@/lib/projects-from-generation"
    );
    expect(SYNC_GENERATIONS_TO_PROJECTS_BATCH).toBe(20);
  });
});
