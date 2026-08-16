import { scrubProviderSecretsFromUrl } from "@/lib/image-utils";
import { sanitizeUserInput } from "@/lib/ai/sanitize";
import { fetchGeneratedImageForRehost } from "@/lib/safe-url";

export type ImageProviderName =
  | "openai"
  | "recraft"
  | "stability"
  | "pollinations";

export type ImageGenerationResult = {
  imageUrl: string;
  provider: ImageProviderName;
};

/** Cap for prompts sent to any image provider (URL length / token spend). */
export const MAX_IMAGE_PROVIDER_PROMPT_CHARS = 4_000;

/**
 * Sanitize model- or user-derived text before forwarding to image providers
 * (Pollinations URL, OpenAI, etc.). Treats LLM output as untrusted input.
 */
export function prepareImageProviderPrompt(raw: string): string {
  return sanitizeUserInput(raw, {
    maxChars: MAX_IMAGE_PROVIDER_PROMPT_CHARS,
  }).trim();
}

const IMAGE_FETCH_TIMEOUT_MS = 45_000;

function withTimeoutSignal(timeoutMs: number): {
  signal: AbortSignal;
  clear: () => void;
} {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timer),
  };
}

async function rehostGeneratedImage(
  buffer: ArrayBuffer,
  contentType: string
): Promise<string | null> {
  if (!process.env.UPLOADTHING_TOKEN) {
    return null;
  }

  try {
    const { UTApi, UTFile } = await import("uploadthing/server");
    const utapi = new UTApi();
    const extension = contentType.includes("png")
      ? "png"
      : contentType.includes("webp")
        ? "webp"
        : "jpg";
    const file = new UTFile(
      [Buffer.from(buffer)],
      `generated-${Date.now()}.${extension}`,
      { type: contentType.split(";")[0].trim() || "image/jpeg" }
    );
    const result = await utapi.uploadFiles(file);
    if (result.error || !result.data?.ufsUrl) {
      console.error("Failed to rehost generated image:", result.error);
      return null;
    }
    return result.data.ufsUrl;
  } catch (error) {
    console.error("Failed to rehost generated image:", error);
    return null;
  }
}

function bufferToDataUrl(buffer: ArrayBuffer, contentType: string): string {
  const base64 = Buffer.from(buffer).toString("base64");
  return `data:${contentType};base64,${base64}`;
}

async function resolveBufferToUrl(
  buffer: ArrayBuffer,
  contentType: string,
  provider: ImageProviderName
): Promise<ImageGenerationResult> {
  const hostedUrl = await rehostGeneratedImage(buffer, contentType);
  if (hostedUrl) {
    return { imageUrl: hostedUrl, provider };
  }
  return {
    imageUrl: bufferToDataUrl(buffer, contentType),
    provider,
  };
}

function pickOpenAiSize(width: number, height: number): "1024x1024" | "1792x1024" | "1024x1792" {
  if (width > height * 1.2) return "1792x1024";
  if (height > width * 1.2) return "1024x1792";
  return "1024x1024";
}

/**
 * Provider preference: paid quality providers first when keys exist,
 * then free Pollinations fallback.
 */
export function getImageProviderOrder(): ImageProviderName[] {
  const order: ImageProviderName[] = [];
  if (process.env.OPENAI_API_KEY) order.push("openai");
  if (process.env.RECRAFT_API_KEY) order.push("recraft");
  if (process.env.STABILITY_API_KEY) order.push("stability");
  order.push("pollinations");
  return order;
}

async function generateWithOpenAI(params: {
  prompt: string;
  width: number;
  height: number;
}): Promise<ImageGenerationResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is missing");

  const timeout = withTimeoutSignal(IMAGE_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt: params.prompt.slice(0, 4_000),
        size: pickOpenAiSize(params.width, params.height),
        quality: "standard",
        response_format: "b64_json",
        n: 1,
      }),
      signal: timeout.signal,
    });

    if (!response.ok) {
      throw new Error(`OpenAI image failed: ${response.status}`);
    }

    const data = (await response.json()) as {
      data?: Array<{ b64_json?: string; url?: string }>;
    };
    const item = data.data?.[0];
    if (item?.b64_json) {
      const buffer = Buffer.from(item.b64_json, "base64");
      return resolveBufferToUrl(
        buffer.buffer.slice(
          buffer.byteOffset,
          buffer.byteOffset + buffer.byteLength
        ),
        "image/png",
        "openai"
      );
    }
    if (item?.url) {
      return materializeRemoteImageUrl(item.url, "openai");
    }
    throw new Error("OpenAI image response missing data");
  } finally {
    timeout.clear();
  }
}

async function generateWithRecraft(params: {
  prompt: string;
  width: number;
  height: number;
}): Promise<ImageGenerationResult> {
  const apiKey = process.env.RECRAFT_API_KEY;
  if (!apiKey) throw new Error("RECRAFT_API_KEY is missing");

  const timeout = withTimeoutSignal(IMAGE_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(
      "https://external.api.recraft.ai/v1/images/generations",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: params.prompt.slice(0, 4_000),
          size: pickOpenAiSize(params.width, params.height),
          response_format: "b64_json",
          n: 1,
        }),
        signal: timeout.signal,
      }
    );

    if (!response.ok) {
      throw new Error(`Recraft image failed: ${response.status}`);
    }

    const data = (await response.json()) as {
      data?: Array<{ b64_json?: string; url?: string }>;
    };
    const item = data.data?.[0];
    if (item?.b64_json) {
      const buffer = Buffer.from(item.b64_json, "base64");
      return resolveBufferToUrl(
        buffer.buffer.slice(
          buffer.byteOffset,
          buffer.byteOffset + buffer.byteLength
        ),
        "image/png",
        "recraft"
      );
    }
    if (item?.url) {
      return materializeRemoteImageUrl(item.url, "recraft");
    }
    throw new Error("Recraft image response missing data");
  } finally {
    timeout.clear();
  }
}

async function generateWithStability(params: {
  prompt: string;
  width: number;
  height: number;
}): Promise<ImageGenerationResult> {
  const apiKey = process.env.STABILITY_API_KEY;
  if (!apiKey) throw new Error("STABILITY_API_KEY is missing");

  // Stability core endpoint expects multiples of 64 within supported bounds.
  const width = Math.min(1536, Math.max(640, Math.round(params.width / 64) * 64));
  const height = Math.min(1536, Math.max(640, Math.round(params.height / 64) * 64));

  const form = new FormData();
  form.append("prompt", params.prompt.slice(0, 4_000));
  form.append("output_format", "png");
  form.append("width", String(width));
  form.append("height", String(height));

  const timeout = withTimeoutSignal(IMAGE_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(
      "https://api.stability.ai/v2beta/stable-image/generate/core",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "image/*",
        },
        body: form,
        signal: timeout.signal,
      }
    );

    if (!response.ok) {
      throw new Error(`Stability image failed: ${response.status}`);
    }

    const contentType = response.headers.get("content-type") || "image/png";
    const buffer = await response.arrayBuffer();
    return resolveBufferToUrl(buffer, contentType, "stability");
  } finally {
    timeout.clear();
  }
}

function buildPollinationsImageUrl({
  prompt,
  width,
  height,
  seed,
  includeApiKey,
}: {
  prompt: string;
  width: number;
  height: number;
  seed: number;
  includeApiKey: boolean;
}) {
  const url = new URL(
    `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}`
  );
  url.searchParams.set("model", "flux");
  url.searchParams.set("width", String(width));
  url.searchParams.set("height", String(height));
  url.searchParams.set("seed", String(seed));
  url.searchParams.set("nologo", "true");

  const apiKey = process.env.POLLINATIONS_API_KEY;
  if (includeApiKey && apiKey) {
    url.searchParams.set("key", apiKey);
  }

  return url;
}

/**
 * Pollinations encodes the full prompt in `/prompt/{encoded}` paths.
 * Those URLs must never be returned to clients or persisted.
 */
export function isPromptEmbeddedPollinationsUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    if (host !== "pollinations.ai" && !host.endsWith(".pollinations.ai")) {
      return false;
    }
    return url.pathname.startsWith("/prompt/");
  } catch {
    return false;
  }
}

async function materializeRemoteImageUrl(
  imageUrl: string,
  provider: ImageProviderName
): Promise<ImageGenerationResult> {
  const scrubbed = scrubProviderSecretsFromUrl(imageUrl);
  const fetched = await fetchGeneratedImageForRehost(scrubbed);
  if (!fetched) {
    throw new Error("Failed to fetch provider image for rehost");
  }
  return resolveBufferToUrl(fetched.buffer, fetched.contentType, provider);
}

async function generateWithPollinations(params: {
  prompt: string;
  width: number;
  height: number;
}): Promise<ImageGenerationResult> {
  const seed = Date.now() % 1_000_000;
  const fetchUrl = buildPollinationsImageUrl({
    prompt: params.prompt,
    width: params.width,
    height: params.height,
    seed,
    includeApiKey: true,
  });

  const timeout = withTimeoutSignal(IMAGE_FETCH_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(fetchUrl.toString(), { signal: timeout.signal });
  } finally {
    timeout.clear();
  }

  if (!response.ok) {
    throw new Error(`Image generation failed: ${response.statusText}`);
  }

  const contentType = response.headers.get("content-type") || "image/jpeg";

  if (contentType.includes("application/json")) {
    const data = await response.json();
    if (typeof data?.url === "string" && data.url.length > 0) {
      return materializeRemoteImageUrl(data.url, "pollinations");
    }
    throw new Error("Unexpected image response format");
  }

  if (contentType.startsWith("image/")) {
    const buffer = await response.arrayBuffer();
    // Always rehost or use a data URL — never return the prompt-bearing
    // Pollinations URL to clients or the database.
    return resolveBufferToUrl(buffer, contentType, "pollinations");
  }

  const buffer = await response.arrayBuffer();
  return {
    imageUrl: bufferToDataUrl(buffer, contentType),
    provider: "pollinations",
  };
}

/**
 * Try configured image providers in preference order; Pollinations is always last.
 */
export async function generateImageWithRouter({
  prompt,
  width = 1024,
  height = 1024,
}: {
  prompt: string;
  width?: number;
  height?: number;
}): Promise<ImageGenerationResult> {
  const safePrompt = prepareImageProviderPrompt(prompt);
  if (!safePrompt) {
    throw new Error("Image prompt is empty after sanitization");
  }

  const errors: Error[] = [];
  const order = getImageProviderOrder();

  for (const provider of order) {
    try {
      if (provider === "openai") {
        return await generateWithOpenAI({ prompt: safePrompt, width, height });
      }
      if (provider === "recraft") {
        return await generateWithRecraft({ prompt: safePrompt, width, height });
      }
      if (provider === "stability") {
        return await generateWithStability({
          prompt: safePrompt,
          width,
          height,
        });
      }
      return await generateWithPollinations({
        prompt: safePrompt,
        width,
        height,
      });
    } catch (error) {
      errors.push(error instanceof Error ? error : new Error(String(error)));
      console.warn(`Image provider ${provider} failed:`, error);
    }
  }

  throw errors.at(-1) ?? new Error("All image providers failed");
}
