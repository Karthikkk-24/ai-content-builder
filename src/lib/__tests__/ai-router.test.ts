import { beforeEach, describe, expect, it, vi } from "vitest";

const generateText = vi.fn();

vi.mock("ai", () => ({
  generateText: (...args: unknown[]) => generateText(...args),
}));

vi.mock("@ai-sdk/google", () => ({
  createGoogleGenerativeAI: () => (model: string) => ({ modelId: model }),
}));

vi.mock("@ai-sdk/groq", () => ({
  createGroq: () => (model: string) => ({ modelId: model }),
}));

vi.mock("@/lib/safe-url", () => ({
  fetchAllowlistedImage: vi.fn(),
  isAllowedDataImageUrl: vi.fn(() => false),
}));

vi.mock("@/lib/image-utils", () => ({
  scrubProviderSecretsFromUrl: (url: string) => url,
}));

describe("AI router retry helpers", () => {
  it("classifies retryable Gemini errors", async () => {
    const { __retryHelpers } = await import("@/lib/ai/router");
    expect(__retryHelpers.isRetryableGeminiError(new Error("quota exceeded"))).toBe(
      true
    );
    expect(
      __retryHelpers.isRetryableGeminiError(new Error("RESOURCE_EXHAUSTED"))
    ).toBe(true);
    expect(
      __retryHelpers.isRetryableGeminiError(new Error("network timeout"))
    ).toBe(true);
    expect(
      __retryHelpers.isRetryableGeminiError(new Error("invalid api key"))
    ).toBe(false);
  });

  it("classifies retryable Groq errors", async () => {
    const { __retryHelpers } = await import("@/lib/ai/router");
    expect(__retryHelpers.isRetryableGroqError(new Error("rate limit"))).toBe(
      true
    );
    expect(
      __retryHelpers.isRetryableGroqError(new Error("content policy"))
    ).toBe(false);
  });
});

describe("generateTextWithFallback", () => {
  beforeEach(() => {
    generateText.mockReset();
    vi.unstubAllEnvs();
    vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "test-google-key");
    vi.stubEnv("GROQ_API_KEY", "test-groq-key");
  });

  it("retries Gemini on retryable failures then succeeds", async () => {
    vi.useFakeTimers();
    generateText
      .mockRejectedValueOnce(new Error("rate limit"))
      .mockResolvedValueOnce({ text: "ok from gemini" });

    try {
      const { generateTextWithFallback } = await import("@/lib/ai/router");
      const pending = generateTextWithFallback({
        system: "sys",
        prompt: "hello",
      });
      await vi.runAllTimersAsync();
      const result = await pending;
      expect(result.text).toBe("ok from gemini");
      expect(result.provider).toBe("gemini");
      expect(generateText).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("falls back to Groq when Gemini models fail non-retryably", async () => {
    // Four Gemini models × one attempt each (non-retryable), then Groq.
    for (let i = 0; i < 4; i++) {
      generateText.mockRejectedValueOnce(new Error("invalid api key"));
    }
    generateText.mockResolvedValueOnce({ text: "ok from groq" });

    const { generateTextWithFallback } = await import("@/lib/ai/router");
    const result = await generateTextWithFallback({
      system: "sys",
      prompt: "hello",
    });
    expect(result.text).toBe("ok from groq");
    expect(result.provider).toBe("groq");
    expect(generateText).toHaveBeenCalledTimes(5);
  });
});
