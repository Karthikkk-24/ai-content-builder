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

  it("renders paragraphs with blank-line separation", () => {
    const md = blocksToMarkdown([
      { id: "1", type: "paragraph", content: "One" },
      { id: "2", type: "paragraph", content: "Two" },
    ]);
    expect(md).toContain("One\n\nTwo");
  });
});
