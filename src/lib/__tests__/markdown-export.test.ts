import { describe, expect, it } from "vitest";
import {
  blocksToMarkdown,
  sanitizeBlockContentForMarkdown,
} from "@/lib/markdown-export";

describe("sanitizeBlockContentForMarkdown", () => {
  it("strips HTML tags", () => {
    expect(
      sanitizeBlockContentForMarkdown("Hi <script>alert(1)</script> there", "paragraph")
    ).toBe("Hi alert(1) there");
  });

  it("neutralizes heading markers inside paragraphs", () => {
    expect(
      sanitizeBlockContentForMarkdown("# injected heading", "paragraph")
    ).toBe("#\\ injected heading");
  });
});

describe("blocksToMarkdown", () => {
  it("escapes unsafe link protocols", () => {
    const md = blocksToMarkdown([
      {
        id: "1",
        type: "cta",
        content: "Click",
        url: "javascript:alert(1)",
      },
    ]);
    expect(md).toContain("[Click](#)");
    expect(md).not.toContain("javascript:");
  });

  it("keeps raster data:image URLs on image blocks", () => {
    const src = "data:image/png;base64,aaa";
    const md = blocksToMarkdown([
      {
        id: "1",
        type: "image",
        content: "Shot",
        url: src,
      },
    ]);
    expect(md).toContain(`![Shot](${src})`);
  });

  it("still drops data: URLs on CTA links and non-raster data images", () => {
    const md = blocksToMarkdown([
      {
        id: "1",
        type: "cta",
        content: "Click",
        url: "data:text/html;base64,PHNjcmlwdD4=",
      },
      {
        id: "2",
        type: "image",
        content: "Bad",
        url: "data:image/svg+xml;base64,PHN2Zz4=",
      },
    ]);
    expect(md).toContain("[Click](#)");
    expect(md).not.toContain("data:text/html");
    expect(md).not.toContain("data:image/svg");
  });

  it("renders paragraphs with blank-line separation", () => {
    const md = blocksToMarkdown([
      { id: "1", type: "paragraph", content: "One" },
      { id: "2", type: "paragraph", content: "Two" },
    ]);
    expect(md).toContain("One\n\nTwo");
  });
});
