import { describe, expect, it } from "vitest";
import {
  moderateAiImageOutput,
  moderateAiTextOutput,
  OUTPUT_CHAR_LIMITS,
} from "@/lib/ai/moderate";

describe("moderateAiTextOutput", () => {
  it("passes clean text through unchanged", () => {
    const result = moderateAiTextOutput("Hello world", "caption");
    expect(result).toMatchObject({
      text: "Hello world",
      blocked: false,
      truncated: false,
      strippedHtml: false,
    });
  });

  it("strips HTML tags from otherwise safe text", () => {
    const result = moderateAiTextOutput(
      "Buy now <b>today</b> for savings",
      "caption"
    );
    expect(result.blocked).toBe(false);
    expect(result.strippedHtml).toBe(true);
    expect(result.text).toBe("Buy now today for savings");
  });

  it("blocks outputs dominated by executable markup", () => {
    const result = moderateAiTextOutput(
      '<script>alert(1)</script><iframe src="x"></iframe>javascript:alert(2)',
      "blog"
    );
    expect(result.blocked).toBe(true);
    expect(result.text).toBe("");
  });

  it("enforces blog length cap", () => {
    const huge = "a".repeat(OUTPUT_CHAR_LIMITS.blog + 500);
    const result = moderateAiTextOutput(huge, "blog");
    expect(result.truncated).toBe(true);
    expect(result.text.length).toBe(OUTPUT_CHAR_LIMITS.blog);
  });

  it("enforces default length for unknown types", () => {
    const huge = "b".repeat(OUTPUT_CHAR_LIMITS.default + 10);
    const result = moderateAiTextOutput(huge, "unknown");
    expect(result.truncated).toBe(true);
    expect(result.text.length).toBe(OUTPUT_CHAR_LIMITS.default);
  });
});

describe("moderateAiImageOutput", () => {
  it("allows https image URLs and scrubs secrets", () => {
    const result = moderateAiImageOutput(
      "https://image.pollinations.ai/x.jpg?key=secret&seed=1"
    );
    expect(result.blocked).toBe(false);
    expect(result.url).toBe("https://image.pollinations.ai/x.jpg?seed=1");
  });

  it("blocks arbitrary https hosts and prompt-embedded Pollinations paths", () => {
    expect(moderateAiImageOutput("https://evil.example/x.jpg").blocked).toBe(
      true
    );
    expect(
      moderateAiImageOutput(
        "https://image.pollinations.ai/prompt/hello%20world"
      ).blocked
    ).toBe(true);
  });

  it("allows data:image jpeg/png", () => {
    const result = moderateAiImageOutput("data:image/png;base64,aaaa");
    expect(result.blocked).toBe(false);
  });

  it("blocks http and svg data URLs", () => {
    expect(moderateAiImageOutput("http://evil.example/x.jpg").blocked).toBe(
      true
    );
    expect(
      moderateAiImageOutput("data:image/svg+xml;base64,PHN2Zy8+").blocked
    ).toBe(true);
  });
});
