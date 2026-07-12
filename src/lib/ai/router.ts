import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { generateText } from "ai";

export type TextProvider = "gemini" | "groq";

const GEMINI_MODELS = [
  "gemini-3.5-flash",
  "gemini-flash-latest",
  "gemini-3.1-flash-lite",
  "gemini-flash-lite-latest",
] as const;

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

function getGroqClient() {
  if (!process.env.GROQ_API_KEY) {
    return null;
  }

  return createGroq({
    apiKey: process.env.GROQ_API_KEY,
  });
}

async function generateWithGemini({
  system,
  prompt,
  modelName = GEMINI_MODELS[0],
}: {
  system: string;
  prompt: string;
  modelName?: (typeof GEMINI_MODELS)[number];
}) {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    throw new Error("Google AI API key is missing");
  }

  const result = await generateText({
    model: google(modelName),
    system,
    prompt,
  });

  return { text: result.text, provider: "gemini" as const, model: modelName };
}

async function generateWithGroq({
  system,
  prompt,
}: {
  system: string;
  prompt: string;
}) {
  const groq = getGroqClient();
  if (!groq) {
    throw new Error("Groq API key is missing");
  }

  const result = await generateText({
    model: groq("llama-3.3-70b-versatile"),
    system,
    prompt,
  });

  return { text: result.text, provider: "groq" as const, model: "llama-3.3-70b-versatile" };
}

export async function generateTextWithFallback({
  system,
  prompt,
  preferredProvider = "gemini",
}: {
  system: string;
  prompt: string;
  preferredProvider?: TextProvider;
}) {
  const errors: Error[] = [];

  const tryGemini = async () => {
    for (const modelName of GEMINI_MODELS) {
      try {
        return await generateWithGemini({ system, prompt, modelName });
      } catch (error) {
        errors.push(error instanceof Error ? error : new Error(String(error)));
      }
    }
    return null;
  };

  const tryGroq = async () => {
    if (!process.env.GROQ_API_KEY) {
      return null;
    }

    try {
      return await generateWithGroq({ system, prompt });
    } catch (error) {
      errors.push(error instanceof Error ? error : new Error(String(error)));
      return null;
    }
  };

  const providers: Array<"gemini" | "groq"> =
    preferredProvider === "gemini" ? ["gemini", "groq"] : ["groq", "gemini"];

  for (const provider of providers) {
    const result = provider === "gemini" ? await tryGemini() : await tryGroq();
    if (result) {
      return result;
    }
  }

  throw errors.at(-1) ?? new Error("All text providers failed");
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

    for (const modelName of GEMINI_MODELS) {
      try {
        const result = await generateText({
          model: google(modelName),
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
        continue;
      }
    }

    return "";
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

  const url = new URL(`https://image.pollinations.ai/prompt/${encodedPrompt}`);
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
