import { beforeEach, describe, expect, it, vi } from "vitest";

const deleteWhere = vi.fn();
const invalidateUserCache = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    delete: () => ({
      where: (...args: unknown[]) => deleteWhere(...args),
    }),
  },
}));

vi.mock("@/lib/cache", () => ({
  invalidateUserCache: (...args: unknown[]) => invalidateUserCache(...args),
}));

describe("withGenerationProjectRollback", () => {
  beforeEach(() => {
    deleteWhere.mockReset();
    invalidateUserCache.mockReset();
    deleteWhere.mockResolvedValue(undefined);
    invalidateUserCache.mockResolvedValue(undefined);
  });

  it("returns the work result when project save succeeds", async () => {
    const { withGenerationProjectRollback } = await import(
      "@/lib/projects-from-generation"
    );
    const result = await withGenerationProjectRollback(
      "gen_1",
      "user_1",
      async () => "proj_1"
    );
    expect(result).toBe("proj_1");
    expect(deleteWhere).not.toHaveBeenCalled();
  });

  it("deletes the generation when project save fails", async () => {
    const { withGenerationProjectRollback } = await import(
      "@/lib/projects-from-generation"
    );
    await expect(
      withGenerationProjectRollback("gen_1", "user_1", async () => {
        throw new Error("project insert failed");
      })
    ).rejects.toThrow("project insert failed");

    expect(deleteWhere).toHaveBeenCalled();
    expect(invalidateUserCache).toHaveBeenCalledWith("user_1");
  });
});
