import { beforeEach, describe, expect, it, vi } from "vitest";

const insertValues = vi.fn();
const invalidateUserCache = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    insert: () => ({
      values: (...args: unknown[]) => {
        insertValues(...args);
        return {
          returning: async () => [{ id: "proj_test_1" }],
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

    await saveImageGenerationAsProject({
      userId: "user_1",
      type: "poster",
      prompt: "Neon city poster",
      imageUrl: "https://image.pollinations.ai/prompt/neon",
    });

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

  it("does not persist oversized data URLs on image blocks", async () => {
    const { MAX_STORABLE_DATA_URL_LENGTH } = await import("@/lib/image-utils");
    const { saveImageGenerationAsProject } = await import(
      "@/lib/projects-from-generation"
    );

    await saveImageGenerationAsProject({
      userId: "user_1",
      type: "photo",
      prompt: "Huge raster",
      imageUrl: `data:image/png;base64,${"a".repeat(MAX_STORABLE_DATA_URL_LENGTH + 1)}`,
    });

    const payload = insertValues.mock.calls[0][0] as {
      blocks: Array<{ type: string; url?: string }>;
    };
    const imageBlock = payload.blocks.find((block) => block.type === "image");
    expect(imageBlock?.url).toBe("");
  });
});
