import { describe, expect, it } from "vitest";
import {
  appendRemarks,
  buildBlogSystemPrompt,
  buildCaptionSystemPrompt,
  buildPhotoSystemPrompt,
  buildPosterSystemPrompt,
  buildPromptUpgradeUserMessage,
  buildTweetSystemPrompt,
} from "@/lib/ai/prompts/prompt-upgrade";

describe("prompt builders", () => {
  it("buildTweetSystemPrompt includes tone and audience as untrusted data", () => {
    const prompt = buildTweetSystemPrompt({
      tone: "witty",
      audience: "developers",
      threadMode: false,
    });
    expect(prompt).toContain("BEGIN_UNTRUSTED_USER_CONTENT");
    expect(prompt).toContain("witty");
    expect(prompt).toContain("developers");
    expect(prompt).toContain("Generate a single tweet under 280 characters");
  });

  it("buildTweetSystemPrompt switches to thread mode", () => {
    const prompt = buildTweetSystemPrompt({ threadMode: true });
    expect(prompt).toContain("thread with 3-5 tweets");
  });

  it("buildBlogSystemPrompt uses blog-type structure hints", () => {
    const howTo = buildBlogSystemPrompt({ blogType: "how-to" });
    expect(howTo).toContain("numbered steps");
    const listicle = buildBlogSystemPrompt({ blogType: "listicle" });
    expect(listicle).toContain("listicle");
  });

  it("buildCaptionSystemPrompt applies platform limits", () => {
    const ig = buildCaptionSystemPrompt({ platform: "Instagram", tone: "casual" });
    expect(ig).toContain("2200");
    expect(ig).toContain("BEGIN_UNTRUSTED_USER_CONTENT");
    expect(ig).toContain("Instagram");
    expect(ig).toContain("casual");
  });

  it("buildPosterSystemPrompt and buildPhotoSystemPrompt include style", () => {
    expect(buildPosterSystemPrompt({ style: "bold", aspectRatio: "16:9" })).toContain(
      "bold"
    );
    expect(buildPhotoSystemPrompt({ style: "cinematic", negativePrompt: "blur" })).toContain(
      "BEGIN_UNTRUSTED_USER_CONTENT"
    );
    expect(buildPhotoSystemPrompt({ style: "cinematic", negativePrompt: "blur" })).toContain(
      "blur"
    );
  });

  it("buildPromptUpgradeUserMessage delimits untrusted prompt text", () => {
    const message = buildPromptUpgradeUserMessage("make a logo", {
      generationType: "poster",
      tone: "modern",
    });
    expect(message).toContain("BEGIN_UNTRUSTED_USER_CONTENT");
    expect(message).toContain("poster");
    expect(message).toContain("modern");
  });

  it("appendRemarks ignores blank remarks", () => {
    expect(appendRemarks("Base", "   ")).toBe("Base");
  });
});
