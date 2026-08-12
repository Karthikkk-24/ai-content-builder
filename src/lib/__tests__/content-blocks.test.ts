import { describe, expect, it } from "vitest";
import {
  MAX_PROJECT_BLOCKS,
  contentBlockSchema,
  projectBlocksSchema,
} from "@/lib/content-blocks";

describe("contentBlockSchema", () => {
  it("accepts a valid heading block", () => {
    const parsed = contentBlockSchema.safeParse({
      id: "block-1",
      type: "heading",
      content: "Hello",
      level: 2,
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects unknown block types", () => {
    const parsed = contentBlockSchema.safeParse({
      id: "block-1",
      type: "script",
      content: "x",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects javascript: URLs on image blocks", () => {
    const parsed = contentBlockSchema.safeParse({
      id: "block-1",
      type: "image",
      content: "alt",
      url: "javascript:alert(1)",
    });
    expect(parsed.success).toBe(false);
  });

  it("allows empty image URLs and https URLs", () => {
    expect(
      contentBlockSchema.safeParse({
        id: "block-1",
        type: "image",
        content: "alt",
        url: "",
      }).success
    ).toBe(true);
    expect(
      contentBlockSchema.safeParse({
        id: "block-1",
        type: "cta",
        content: "Go",
        url: "https://example.com/path",
      }).success
    ).toBe(true);
  });

  it("rejects non-allowlisted hosts on image blocks", () => {
    expect(
      contentBlockSchema.safeParse({
        id: "block-1",
        type: "image",
        content: "alt",
        url: "https://attacker.example/track.png",
      }).success
    ).toBe(false);
    expect(
      contentBlockSchema.safeParse({
        id: "block-1",
        type: "image",
        content: "alt",
        url: "https://image.pollinations.ai/out.jpg",
      }).success
    ).toBe(true);
  });
});

describe("projectBlocksSchema", () => {
  it("caps array length", () => {
    const blocks = Array.from({ length: MAX_PROJECT_BLOCKS + 1 }, (_, i) => ({
      id: `b-${i}`,
      type: "paragraph" as const,
      content: "x",
    }));
    expect(projectBlocksSchema.safeParse(blocks).success).toBe(false);
    expect(
      projectBlocksSchema.safeParse(blocks.slice(0, MAX_PROJECT_BLOCKS)).success
    ).toBe(true);
  });
});
