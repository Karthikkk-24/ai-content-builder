import { beforeEach, describe, expect, it, vi } from "vitest";

const insertValues = vi.fn();
const saveTextGenerationAsProject = vi.fn();
const generateTextWithFallback = vi.fn();
const analyzeReferenceImage = vi.fn();
const invalidateUserCache = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    insert: () => ({
      values: (...args: unknown[]) => insertValues(...args),
    }),
  },
}));

vi.mock("@/lib/cache", () => ({
  invalidateUserCache: (...args: unknown[]) => invalidateUserCache(...args),
}));

vi.mock("@/lib/projects-from-generation", () => ({
  saveTextGenerationAsProject: (...args: unknown[]) =>
    saveTextGenerationAsProject(...args),
}));

vi.mock("@/lib/ai/router", () => ({
  generateTextWithFallback: (...args: unknown[]) =>
    generateTextWithFallback(...args),
  analyzeReferenceImage: (...args: unknown[]) => analyzeReferenceImage(...args),
}));

describe("generateAndPersistText", () => {
  beforeEach(() => {
    insertValues.mockReset();
    saveTextGenerationAsProject.mockReset();
    generateTextWithFallback.mockReset();
    analyzeReferenceImage.mockReset();
    invalidateUserCache.mockReset();

    insertValues.mockResolvedValue(undefined);
    invalidateUserCache.mockResolvedValue(undefined);
    generateTextWithFallback.mockResolvedValue({
      text: "Hello world",
      provider: "gemini",
    });
    saveTextGenerationAsProject.mockResolvedValue("project_abc");
  });

  it("creates a project on first generate", async () => {
    const { generateAndPersistText } = await import("@/lib/ai/text-generation");

    const result = await generateAndPersistText({
      userId: "user_1",
      prompt: "Write a tweet",
      context: { generationType: "tweet", tone: "casual" },
      regenerate: false,
    });

    expect(result.projectId).toBe("project_abc");
    expect(saveTextGenerationAsProject).toHaveBeenCalledTimes(1);
  });

  it("skips project creation when regenerating", async () => {
    const { generateAndPersistText } = await import("@/lib/ai/text-generation");

    const result = await generateAndPersistText({
      userId: "user_1",
      prompt: "Write a tweet",
      context: { generationType: "tweet" },
      regenerate: true,
      remarks: "Make it shorter",
    });

    expect(result.projectId).toBeNull();
    expect(saveTextGenerationAsProject).not.toHaveBeenCalled();
    expect(insertValues).toHaveBeenCalled();
  });
});
