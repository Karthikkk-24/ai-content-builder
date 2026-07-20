import { beforeEach, describe, expect, it, vi } from "vitest";

const insertValues = vi.fn();
const invalidateUserCache = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    insert: () => ({
      values: (...args: unknown[]) => {
        insertValues(...args);
        return {
          returning: async () => [{ id: "project_img_1" }],
        };
      },
    }),
  },
}));

vi.mock("@/lib/cache", () => ({
  invalidateUserCache: (...args: unknown[]) => invalidateUserCache(...args),
}));

vi.mock("crypto", async () => {
  const actual = await vi.importActual<typeof import("crypto")>("crypto");
  return {
    ...actual,
    randomUUID: () => "00000000-0000-0000-0000-000000000001",
  };
});

describe("saveImageGenerationAsProject", () => {
  beforeEach(() => {
    insertValues.mockReset();
    invalidateUserCache.mockReset();
    invalidateUserCache.mockResolvedValue(undefined);
  });

  it("creates an image block with the generated URL", async () => {
    const { saveImageGenerationAsProject } = await import(
      "@/lib/projects-from-generation"
    );

    const projectId = await saveImageGenerationAsProject({
      userId: "user_1",
      type: "poster",
      prompt: "Neon city poster",
      imageUrl: "https://image.pollinations.ai/prompt/neon",
    });

    expect(projectId).toBe("project_img_1");
    expect(insertValues).toHaveBeenCalledTimes(1);
    const payload = insertValues.mock.calls[0][0];

    expect(payload.userId).toBe("user_1");
    expect(payload.title).toBe("Neon city poster");
    expect(payload.blocks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "image",
          content: "Neon city poster",
          url: "https://image.pollinations.ai/prompt/neon",
        }),
      ])
    );
    expect(invalidateUserCache).toHaveBeenCalledWith("user_1");
  });
});
