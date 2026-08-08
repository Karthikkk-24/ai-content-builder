import { describe, expect, it } from "vitest";
import {
  assertSafeExternalImageUrl,
  isAllowedDataImageUrl,
} from "@/lib/safe-url";

describe("assertSafeExternalImageUrl", () => {
  it("allows Uploadthing and Pollinations HTTPS hosts", () => {
    expect(
      assertSafeExternalImageUrl("https://utfs.io/f/abc.png").ok
    ).toBe(true);
    expect(
      assertSafeExternalImageUrl("https://foo.ufs.sh/f/abc.png").ok
    ).toBe(true);
    expect(
      assertSafeExternalImageUrl(
        "https://image.pollinations.ai/prompt/test"
      ).ok
    ).toBe(true);
  });

  it("rejects http, credentials, and non-allowlisted hosts", () => {
    expect(assertSafeExternalImageUrl("http://utfs.io/f/x").ok).toBe(false);
    expect(
      assertSafeExternalImageUrl("https://user:pass@utfs.io/f/x").ok
    ).toBe(false);
    expect(
      assertSafeExternalImageUrl("https://evil.example/logo.png").ok
    ).toBe(false);
  });

  it("rejects localhost, metadata, and IP literals (SSRF)", () => {
    expect(assertSafeExternalImageUrl("https://localhost/a.png").ok).toBe(
      false
    );
    expect(
      assertSafeExternalImageUrl("https://169.254.169.254/latest/meta-data/").ok
    ).toBe(false);
    expect(assertSafeExternalImageUrl("https://127.0.0.1/x").ok).toBe(false);
    expect(assertSafeExternalImageUrl("https://10.0.0.5/x").ok).toBe(false);
    expect(
      assertSafeExternalImageUrl("https://metadata.google.internal/").ok
    ).toBe(false);
  });
});

describe("isAllowedDataImageUrl", () => {
  it("allows common raster data URLs only", () => {
    expect(isAllowedDataImageUrl("data:image/png;base64,aaa")).toBe(true);
    expect(isAllowedDataImageUrl("data:image/jpeg;base64,aaa")).toBe(true);
    expect(isAllowedDataImageUrl("data:image/svg+xml;base64,aaa")).toBe(false);
    expect(isAllowedDataImageUrl("data:text/html;base64,aaa")).toBe(false);
  });
});
