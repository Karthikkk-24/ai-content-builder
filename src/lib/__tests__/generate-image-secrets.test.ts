import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const uploadFiles = vi.fn();

vi.mock("uploadthing/server", () => ({
  UTApi: class {
    uploadFiles = uploadFiles;
  },
  UTFile: class {
    constructor(
      public parts: BlobPart[],
      public name: string,
      public options?: { type?: string }
    ) {}
  },
}));

describe("generateImage secret handling", () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.POLLINATIONS_API_KEY;
  const originalUploadToken = process.env.UPLOADTHING_TOKEN;

  beforeEach(() => {
    uploadFiles.mockReset();
    process.env.POLLINATIONS_API_KEY = "super-secret-pollinations-key";
    delete process.env.UPLOADTHING_TOKEN;
    delete process.env.OPENAI_API_KEY;
    delete process.env.RECRAFT_API_KEY;
    delete process.env.STABILITY_API_KEY;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalKey === undefined) {
      delete process.env.POLLINATIONS_API_KEY;
    } else {
      process.env.POLLINATIONS_API_KEY = originalKey;
    }
    if (originalUploadToken === undefined) {
      delete process.env.UPLOADTHING_TOKEN;
    } else {
      process.env.UPLOADTHING_TOKEN = originalUploadToken;
    }
    vi.resetModules();
  });

  it("never returns a URL containing the Pollinations API key", async () => {
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      expect(url).toContain("key=super-secret-pollinations-key");
      const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
      return new Response(bytes, {
        status: 200,
        headers: { "content-type": "image/jpeg" },
      });
    }) as typeof fetch;

    const { generateImage } = await import("@/lib/ai/router");
    const result = await generateImage({ prompt: "a quiet lake at dawn" });

    expect(result.imageUrl).not.toContain("super-secret-pollinations-key");
    expect(result.imageUrl).not.toMatch(/[?&]key=/i);
    expect(result.imageUrl.startsWith("data:image/jpeg;base64,")).toBe(true);
  });

  it("rehosts via Uploadthing when configured and omits the key", async () => {
    process.env.UPLOADTHING_TOKEN = "ut_token";
    uploadFiles.mockResolvedValue({
      data: { ufsUrl: "https://utfs.io/f/generated-safe.jpg" },
      error: null,
    });

    global.fetch = vi.fn(async () => {
      const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
      return new Response(bytes, {
        status: 200,
        headers: { "content-type": "image/jpeg" },
      });
    }) as typeof fetch;

    const { generateImage } = await import("@/lib/ai/router");
    const result = await generateImage({ prompt: "poster art" });

    expect(uploadFiles).toHaveBeenCalledOnce();
    expect(result.imageUrl).toBe("https://utfs.io/f/generated-safe.jpg");
    expect(result.imageUrl).not.toContain("super-secret");
  });

  it("scrubs keys from JSON provider responses", async () => {
    global.fetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          url: "https://image.pollinations.ai/out.jpg?key=super-secret-pollinations-key&seed=1",
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        }
      );
    }) as typeof fetch;

    const { generateImage } = await import("@/lib/ai/router");
    const result = await generateImage({ prompt: "json path" });

    expect(result.imageUrl).toBe(
      "https://image.pollinations.ai/out.jpg?seed=1"
    );
  });
});
