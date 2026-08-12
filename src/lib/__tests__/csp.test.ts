import { describe, expect, it } from "vitest";
import { appContentSecurityPolicy } from "@/lib/csp";

describe("appContentSecurityPolicy", () => {
  it("allows Pollinations and Uploadthing image hosts", () => {
    const img = appContentSecurityPolicy.directives?.["img-src"] ?? [];
    expect(img).toEqual(
      expect.arrayContaining([
        "https://image.pollinations.ai",
        "https://*.pollinations.ai",
        "https://*.ufs.sh",
        "https://*.uploadthing.com",
      ])
    );
  });

  it("hardens object-src and frame-ancestors", () => {
    expect(appContentSecurityPolicy.directives?.["object-src"]).toEqual([
      "none",
    ]);
    expect(appContentSecurityPolicy.directives?.["frame-ancestors"]).toEqual([
      "none",
    ]);
  });
});
