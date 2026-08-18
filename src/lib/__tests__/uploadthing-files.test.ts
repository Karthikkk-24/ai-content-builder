import { describe, expect, it } from "vitest";
import {
  collectUploadthingKeysFromSources,
  collectUploadthingKeysFromStoredContent,
  extractUploadthingFileKey,
  extractUploadthingFileKeysFromText,
  staleUploadthingKeys,
} from "@/lib/uploadthing-files";

describe("extractUploadthingFileKey", () => {
  it("parses utfs.io and ufs.sh /f/ keys", () => {
    expect(extractUploadthingFileKey("https://utfs.io/f/abc.png")).toBe(
      "abc.png"
    );
    expect(
      extractUploadthingFileKey(
        "https://foo.ufs.sh/f/2e0fdb64-9957-4262-8e45-f372ba903ac8_image.jpg"
      )
    ).toBe("2e0fdb64-9957-4262-8e45-f372ba903ac8_image.jpg");
  });

  it("parses /a/{app}/{key} app URLs", () => {
    expect(
      extractUploadthingFileKey("https://abc.ufs.sh/a/appid/my-file.webp")
    ).toBe("my-file.webp");
  });

  it("rejects non-UT hosts, http, and credentials", () => {
    expect(extractUploadthingFileKey("https://evil.example/f/abc.png")).toBe(
      null
    );
    expect(extractUploadthingFileKey("http://utfs.io/f/abc.png")).toBe(null);
    expect(
      extractUploadthingFileKey("https://user:pass@utfs.io/f/abc.png")
    ).toBe(null);
    expect(extractUploadthingFileKey("https://img.clerk.com/f/abc")).toBe(
      null
    );
  });

  it("rejects path traversal and empty keys", () => {
    expect(extractUploadthingFileKey("https://utfs.io/f/..")).toBe(null);
    expect(extractUploadthingFileKey("https://utfs.io/f/")).toBe(null);
    expect(extractUploadthingFileKey("not a url")).toBe(null);
  });
});

describe("extractUploadthingFileKeysFromText", () => {
  it("finds UT URLs embedded in markdown and ignores others", () => {
    const text = [
      "See ![img](https://utfs.io/f/one.png)",
      "and https://pollinations.ai/p/nope",
      "plus https://foo.ufs.sh/f/two.jpg.",
    ].join(" ");
    expect(extractUploadthingFileKeysFromText(text).sort()).toEqual([
      "one.png",
      "two.jpg",
    ]);
  });
});

describe("collectUploadthingKeysFromSources", () => {
  it("dedupes keys from urls and text fields", () => {
    const keys = collectUploadthingKeysFromSources({
      urls: [
        "https://utfs.io/f/abc.png",
        null,
        "https://img.clerk.com/not-ut",
      ],
      texts: ["![x](https://utfs.io/f/abc.png) https://utfs.io/f/other.jpg"],
    });
    expect(keys.sort()).toEqual(["abc.png", "other.jpg"]);
  });
});

describe("collectUploadthingKeysFromStoredContent", () => {
  it("collects keys from project image blocks and generation output", () => {
    const keys = collectUploadthingKeysFromStoredContent({
      blocks: [
        { type: "image", url: "https://utfs.io/f/poster.png", content: "" },
        { type: "paragraph", content: "See https://utfs.io/f/inline.jpg" },
      ],
      outputContent: "![out](https://foo.ufs.sh/f/gen.webp)",
      urls: ["https://utfs.io/f/ref.png"],
    });
    expect(keys.sort()).toEqual([
      "gen.webp",
      "inline.jpg",
      "poster.png",
      "ref.png",
    ]);
  });
});

describe("staleUploadthingKeys", () => {
  it("drops keys that are still referenced elsewhere", () => {
    expect(
      staleUploadthingKeys(["old.png", "shared.png"], ["shared.png", "other.png"])
    ).toEqual(["old.png"]);
  });
});
