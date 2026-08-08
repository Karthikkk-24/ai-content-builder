import { afterEach, describe, expect, it, vi } from "vitest";

describe("getImageProviderOrder", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("always ends with pollinations and prefers configured paid providers", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-openai");
    vi.stubEnv("RECRAFT_API_KEY", "rc-key");
    vi.stubEnv("STABILITY_API_KEY", "st-key");
    const { getImageProviderOrder } = await import("@/lib/ai/image-providers");
    expect(getImageProviderOrder()).toEqual([
      "openai",
      "recraft",
      "stability",
      "pollinations",
    ]);
  });

  it("falls back to pollinations-only when no paid keys exist", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("RECRAFT_API_KEY", "");
    vi.stubEnv("STABILITY_API_KEY", "");
    delete process.env.OPENAI_API_KEY;
    delete process.env.RECRAFT_API_KEY;
    delete process.env.STABILITY_API_KEY;
    const { getImageProviderOrder } = await import("@/lib/ai/image-providers");
    expect(getImageProviderOrder()).toEqual(["pollinations"]);
  });
});
