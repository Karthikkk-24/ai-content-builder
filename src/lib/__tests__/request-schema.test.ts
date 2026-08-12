import { describe, expect, it } from "vitest";
import {
  MAX_AI_PROMPT_LENGTH,
  aiContextSchema,
  aiPromptSchema,
  aiRemarksSchema,
} from "@/lib/ai/request-schema";

describe("ai request schemas", () => {
  it("rejects oversized prompts", () => {
    expect(aiPromptSchema.safeParse("x".repeat(MAX_AI_PROMPT_LENGTH)).success).toBe(
      true
    );
    expect(
      aiPromptSchema.safeParse("x".repeat(MAX_AI_PROMPT_LENGTH + 1)).success
    ).toBe(false);
  });

  it("rejects oversized remarks", () => {
    expect(aiRemarksSchema.safeParse("ok").success).toBe(true);
    expect(aiRemarksSchema.safeParse("r".repeat(2_001)).success).toBe(false);
  });

  it("caps context key count and value length", () => {
    const tooMany: Record<string, string> = {};
    for (let i = 0; i < 21; i++) tooMany[`k${i}`] = "v";
    expect(aiContextSchema.safeParse(tooMany).success).toBe(false);
    expect(
      aiContextSchema.safeParse({ tone: "v".repeat(501) }).success
    ).toBe(false);
    expect(aiContextSchema.safeParse({ tone: "casual" }).success).toBe(true);
  });
});
