import { describe, expect, it } from "vitest";
import { appendRemarks } from "@/lib/ai/prompts/prompt-upgrade";
import { formatAiError } from "@/lib/ai/errors";
import { getApiErrorMessage } from "@/lib/api/client-error";
import {
  GENERATIONS_CACHE_LIMITS,
  generationsCacheKey,
  userCacheKeys,
} from "@/lib/cache";
import {
  GENERATED_IMAGE_PLACEHOLDER,
  sanitizeGeneratedOutputForStorage,
} from "@/lib/image-utils";
import { buildTitle } from "@/lib/projects-from-generation";

describe("appendRemarks", () => {
  it("returns the original message when remarks are empty", () => {
    expect(appendRemarks("Hello", "")).toBe("Hello");
    expect(appendRemarks("Hello")).toBe("Hello");
    expect(appendRemarks("Hello", "   ")).toBe("Hello");
  });

  it("appends remarks for regeneration", () => {
    expect(appendRemarks("Base prompt", "Make it shorter")).toContain(
      "User remarks for this regeneration"
    );
    expect(appendRemarks("Base prompt", "Make it shorter")).toContain(
      "Make it shorter"
    );
  });
});

describe("buildTitle", () => {
  it("uses type draft for empty prompts", () => {
    expect(buildTitle("", "tweet")).toBe("tweet draft");
  });

  it("keeps short prompts intact", () => {
    expect(buildTitle("Launch day", "blog")).toBe("Launch day");
  });

  it("truncates long prompts with ellipsis", () => {
    const long = "a".repeat(80);
    const title = buildTitle(long, "caption");
    expect(title.length).toBe(60);
    expect(title.endsWith("...")).toBe(true);
  });
});

describe("sanitizeGeneratedOutputForStorage", () => {
  it("keeps http image URLs", () => {
    const url = "https://image.pollinations.ai/prompt/test";
    expect(sanitizeGeneratedOutputForStorage(url)).toBe(url);
  });

  it("keeps small data URLs", () => {
    const small = `data:image/png;base64,${"a".repeat(100)}`;
    expect(sanitizeGeneratedOutputForStorage(small)).toBe(small);
  });

  it("replaces oversized data URLs with a sentinel", () => {
    const huge = `data:image/png;base64,${"a".repeat(100_001)}`;
    expect(sanitizeGeneratedOutputForStorage(huge)).toBe(
      GENERATED_IMAGE_PLACEHOLDER
    );
  });
});

describe("formatAiError", () => {
  it("maps quota errors", () => {
    expect(formatAiError(new Error("RESOURCE_EXHAUSTED quota exceeded"))).toMatch(
      /Google AI could not complete/
    );
  });

  it("maps auth errors when Google key is present", () => {
    const previous = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = "test-key";
    expect(formatAiError(new Error("Invalid API key"))).toMatch(/invalid or expired/i);
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = previous;
  });

  it("passes through unknown messages", () => {
    expect(formatAiError(new Error("Something unique happened"))).toBe(
      "Something unique happened"
    );
  });
});

describe("cache keys", () => {
  it("builds generations keys with limit suffixes", () => {
    expect(generationsCacheKey("user_1", 20)).toBe("user:generations:user_1:20");
    expect(generationsCacheKey("user_1", 50)).toBe("user:generations:user_1:50");
  });

  it("tracks known generation cache limits", () => {
    expect([...GENERATIONS_CACHE_LIMITS]).toEqual([20, 50, 100]);
    expect(userCacheKeys("abc").generations).toBe("user:generations:abc");
  });
});

describe("getApiErrorMessage", () => {
  it("reads nested structured errors", () => {
    expect(
      getApiErrorMessage(
        { error: { code: "AI_FAILED", message: "Provider down" } },
        "fallback"
      )
    ).toBe("Provider down");
  });

  it("reads legacy string errors", () => {
    expect(getApiErrorMessage({ error: "Nope" }, "fallback")).toBe("Nope");
  });

  it("uses fallback when payload is empty", () => {
    expect(getApiErrorMessage(null, "fallback")).toBe("fallback");
  });
});
