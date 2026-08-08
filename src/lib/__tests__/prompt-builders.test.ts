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
  it("buildTweetSystemPrompt includes tone and audience", () => {
    const prompt = buildTweetSystemPrompt({
      tone: "witty",
      audience: "developers",
      threadMode: false,
    });
    expect(prompt).toMatchInlineSnapshot(`
      "You are a social media copywriter. Generate a single tweet under 280 characters.
      Tone: witty
      Audience: developers
      Return only the tweet(s), no explanations."
    `);
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
    expect(ig).toMatchInlineSnapshot(`
      "You are a social media copywriter for Instagram.
      Tone: casual
      Hard limit: 2200 characters (including hashtags).
      Hashtag quota: up to 30.
      Platform guidance: Lead with a hook in the first line. Use line breaks for readability. Suggest 5–15 relevant hashtags (max 30). Light emoji OK.
      Return only the caption text. No explanations or surrounding quotes."
    `);
  });

  it("buildPosterSystemPrompt and buildPhotoSystemPrompt include style", () => {
    expect(buildPosterSystemPrompt({ style: "bold", aspectRatio: "16:9" })).toContain(
      "bold"
    );
    expect(buildPhotoSystemPrompt({ style: "cinematic", negativePrompt: "blur" })).toContain(
      "Avoid: blur"
    );
  });

  it("buildPromptUpgradeUserMessage delimits untrusted prompt text", () => {
    const message = buildPromptUpgradeUserMessage("make a logo", {
      generationType: "poster",
      tone: "modern",
    });
    expect(message).toContain("BEGIN_UNTRUSTED_USER_CONTENT");
    expect(message).toContain("Generation type: poster");
    expect(message).toContain("Tone: modern");
  });

  it("appendRemarks ignores blank remarks", () => {
    expect(appendRemarks("Base", "   ")).toBe("Base");
  });
});
