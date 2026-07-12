import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { generateText } from "ai";

export type TextProvider = "gemini" | "groq";

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function generateTextWithFallback({
  system,
  prompt,
  preferredProvider = "gemini",
}: {
  system: string;
  prompt: string;
  preferredProvider?: TextProvider;
}) {
  const providers: TextProvider[] =
    preferredProvider === "gemini" ? ["gemini", "groq"] : ["groq", "gemini"];

  let lastError: Error | null = null;

  for (const provider of providers) {
    try {
      const model =
        provider === "gemini"
          ? google("gemini-2.0-flash")
          : groq("llama-3.3-70b-versatile");

      const result = await generateText({
        model,
        system,
        prompt,
      });

      return { text: result.text, provider };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw lastError ?? new Error("All text providers failed");
}

export async function analyzeReferenceImage(imageUrl: string): Promise<string> {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return "";
  }

  try {
    const response = await fetch(imageUrl);
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const contentType = response.headers.get("content-type") || "image/jpeg";

    const result = await generateText({
      model: google("gemini-2.0-flash"),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Describe this image in detail for use as a reference in AI image generation. Focus on style, composition, colors, lighting, subject matter, and mood. Be concise but descriptive.",
            },
            {
              type: "image",
              image: `data:${contentType};base64,${base64}`,
            },
          ],
        },
      ],
    });

    return result.text;
  } catch {
    return "";
  }
}

export async function generateImage({
  prompt,
  width = 1024,
  height = 1024,
}: {
  prompt: string;
  width?: number;
  height?: number;
}): Promise<{ imageUrl: string; provider: string }> {
  const encodedPrompt = encodeURIComponent(prompt);
  const apiKey = process.env.POLLINATIONS_API_KEY;

  const url = new URL(`https://gen.pollinations.ai/image/${encodedPrompt}`);
  url.searchParams.set("model", "flux");
  url.searchParams.set("width", String(width));
  url.searchParams.set("height", String(height));
  url.searchParams.set("nologo", "true");
  if (apiKey) {
    url.searchParams.set("key", apiKey);
  }

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(`Image generation failed: ${response.statusText}`);
  }

  const contentType = response.headers.get("content-type") || "image/jpeg";

  if (contentType.includes("application/json")) {
    const data = await response.json();
    if (data.url) {
      return { imageUrl: data.url, provider: "pollinations" };
    }
    throw new Error("Unexpected image response format");
  }

  const buffer = await response.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");
  const dataUrl = `data:${contentType};base64,${base64}`;

  return { imageUrl: dataUrl, provider: "pollinations" };
}

export function getAspectDimensions(aspectRatio: string): {
  width: number;
  height: number;
} {
  switch (aspectRatio) {
    case "16:9":
      return { width: 1920, height: 1080 };
    case "9:16":
      return { width: 1080, height: 1920 };
    case "4:3":
      return { width: 1024, height: 768 };
    case "3:2":
      return { width: 1200, height: 800 };
    default:
      return { width: 1024, height: 1024 };
  }
}
