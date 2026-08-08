import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { generateText, streamText } from "ai";
import { sanitizeUserInput } from "@/lib/ai/sanitize";
import {
  fetchAllowlistedImage,
  isAllowedDataImageUrl,
} from "@/lib/safe-url";

export type TextProvider = "gemini" | "groq";

const GEMINI_MODELS = [
  "gemini-3.5-flash",
  "gemini-flash-latest",
  "gemini-3.1-flash-lite",
  "gemini-flash-lite-latest",
] as const;

const GEMINI_RETRY_DELAYS_MS = [400, 1_200, 2_500] as const;
const GEMINI_MAX_ATTEMPTS = GEMINI_RETRY_DELAYS_MS.length + 1;

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

const GEMINI_PROVIDER_SAFETY_SETTINGS = {
  safetySettings: [
    {
      category: "HARM_CATEGORY_HARASSMENT" as const,
      threshold: "BLOCK_MEDIUM_AND_ABOVE" as const,
    },
    {
      category: "HARM_CATEGORY_HATE_SPEECH" as const,
      threshold: "BLOCK_MEDIUM_AND_ABOVE" as const,
    },
    {
      category: "HARM_CATEGORY_SEXUALLY_EXPLICIT" as const,
      threshold: "BLOCK_MEDIUM_AND_ABOVE" as const,
    },
    {
      category: "HARM_CATEGORY_DANGEROUS_CONTENT" as const,
      threshold: "BLOCK_MEDIUM_AND_ABOVE" as const,
    },
    {
      category: "HARM_CATEGORY_CIVIC_INTEGRITY" as const,
      threshold: "BLOCK_MEDIUM_AND_ABOVE" as const,
    },
  ],
};

const AI_CALL_TIMEOUT_MS = 45_000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function isRetryableGeminiError(error: unknown) {
  const message = getErrorMessage(error);
  return /quota|rate limit|resource_exhausted|too many requests|timeout|network|fetch failed|temporar/i.test(
    message
  );
}

function isRetryableGroqError(error: unknown) {
  const message = getErrorMessage(error);
  return /rate limit|timeout|network|temporarily/i.test(message);
}

/** Exported for unit tests of retry classification. */
export const __retryHelpers = {
  isRetryableGeminiError,
  isRetryableGroqError,
  GEMINI_RETRY_DELAYS_MS,
  GEMINI_MAX_ATTEMPTS,
};

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

  let lastError: unknown;

  for (let attempt = 0; attempt < GEMINI_MAX_ATTEMPTS; attempt++) {
    const timeout = withTimeoutSignal(AI_CALL_TIMEOUT_MS);
    try {
      const result = await generateText({
        model: google(modelName),
        system,
        prompt,
        abortSignal: timeout.signal,
        providerOptions: {
          google: GEMINI_PROVIDER_SAFETY_SETTINGS,
        },
      });

      return { text: result.text, provider: "gemini" as const, model: modelName };
    } catch (error) {
      lastError = error;

      if (!isRetryableGeminiError(error) || attempt === GEMINI_MAX_ATTEMPTS - 1) {
        break;
      }

      await sleep(GEMINI_RETRY_DELAYS_MS[attempt]);
    } finally {
      timeout.clear();
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

const GROQ_RETRY_DELAYS_MS = [500, 1_500] as const;
const GROQ_MAX_ATTEMPTS = GROQ_RETRY_DELAYS_MS.length + 1;

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

  let lastError: unknown;

  for (let attempt = 0; attempt < GROQ_MAX_ATTEMPTS; attempt++) {
    const timeout = withTimeoutSignal(AI_CALL_TIMEOUT_MS);
    try {
      const result = await generateText({
        model: groq("llama-3.3-70b-versatile"),
        system,
        prompt,
        abortSignal: timeout.signal,
      });

      return {
        text: result.text,
        provider: "groq" as const,
        model: "llama-3.3-70b-versatile",
      };
    } catch (error) {
      lastError = error;
      if (!isRetryableGroqError(error) || attempt === GROQ_MAX_ATTEMPTS - 1) {
        break;
      }
      await sleep(GROQ_RETRY_DELAYS_MS[attempt]);
    } finally {
      timeout.clear();
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
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

export type StreamTextResult = {
  textStream: AsyncIterable<string>;
  provider: TextProvider;
  model: string;
  fullText: () => Promise<string>;
};

/**
 * Open a streaming completion with the same Gemini → Groq fallback order.
 * Retries apply only while opening the stream (before the first chunk).
 * Mid-stream failures should be handled by the caller (fallback to non-stream).
 */
export async function streamTextWithFallback({
  system,
  prompt,
  preferredProvider = "gemini",
}: {
  system: string;
  prompt: string;
  preferredProvider?: TextProvider;
}): Promise<StreamTextResult> {
  const errors: Error[] = [];

  const openGemini = async (
    modelName: (typeof GEMINI_MODELS)[number]
  ): Promise<StreamTextResult> => {
    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      throw new Error("Google AI API key is missing");
    }

    let lastError: unknown;
    for (let attempt = 0; attempt < GEMINI_MAX_ATTEMPTS; attempt++) {
      const timeout = withTimeoutSignal(AI_CALL_TIMEOUT_MS);
      try {
        const result = streamText({
          model: google(modelName),
          system,
          prompt,
          abortSignal: timeout.signal,
          providerOptions: {
            google: GEMINI_PROVIDER_SAFETY_SETTINGS,
          },
        });

        const iterator = result.textStream[Symbol.asyncIterator]();
        const first = await iterator.next();

        async function* rest() {
          try {
            if (!first.done && first.value) {
              yield first.value;
            }
            while (true) {
              const next = await iterator.next();
              if (next.done) break;
              if (next.value) yield next.value;
            }
          } finally {
            timeout.clear();
          }
        }

        return {
          textStream: rest(),
          provider: "gemini",
          model: modelName,
          fullText: async () => {
            try {
              return await result.text;
            } finally {
              timeout.clear();
            }
          },
        };
      } catch (error) {
        timeout.clear();
        lastError = error;
        if (
          !isRetryableGeminiError(error) ||
          attempt === GEMINI_MAX_ATTEMPTS - 1
        ) {
          break;
        }
        await sleep(GEMINI_RETRY_DELAYS_MS[attempt]);
      }
    }

    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  };

  const openGroq = async (): Promise<StreamTextResult> => {
    const groq = getGroqClient();
    if (!groq) {
      throw new Error("Groq API key is missing");
    }

    let lastError: unknown;
    for (let attempt = 0; attempt < GROQ_MAX_ATTEMPTS; attempt++) {
      const timeout = withTimeoutSignal(AI_CALL_TIMEOUT_MS);
      try {
        const result = streamText({
          model: groq("llama-3.3-70b-versatile"),
          system,
          prompt,
          abortSignal: timeout.signal,
        });

        const iterator = result.textStream[Symbol.asyncIterator]();
        const first = await iterator.next();

        async function* rest() {
          try {
            if (!first.done && first.value) {
              yield first.value;
            }
            while (true) {
              const next = await iterator.next();
              if (next.done) break;
              if (next.value) yield next.value;
            }
          } finally {
            timeout.clear();
          }
        }

        return {
          textStream: rest(),
          provider: "groq",
          model: "llama-3.3-70b-versatile",
          fullText: async () => {
            try {
              return await result.text;
            } finally {
              timeout.clear();
            }
          },
        };
      } catch (error) {
        timeout.clear();
        lastError = error;
        if (!isRetryableGroqError(error) || attempt === GROQ_MAX_ATTEMPTS - 1) {
          break;
        }
        await sleep(GROQ_RETRY_DELAYS_MS[attempt]);
      }
    }

    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  };

  const providers: Array<"gemini" | "groq"> =
    preferredProvider === "gemini" ? ["gemini", "groq"] : ["groq", "gemini"];

  for (const provider of providers) {
    try {
      if (provider === "gemini") {
        for (const modelName of GEMINI_MODELS) {
          try {
            return await openGemini(modelName);
          } catch (error) {
            errors.push(
              error instanceof Error ? error : new Error(String(error))
            );
          }
        }
      } else {
        return await openGroq();
      }
    } catch (error) {
      errors.push(error instanceof Error ? error : new Error(String(error)));
    }
  }

  throw errors.at(-1) ?? new Error("All text providers failed to stream");
}

export async function analyzeReferenceImage(imageUrl: string): Promise<string> {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return "";
  }

  try {
    let base64: string;
    let contentType: string;

    if (imageUrl.startsWith("data:")) {
      if (!isAllowedDataImageUrl(imageUrl)) return "";
      const match = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) return "";
      contentType = match[1];
      base64 = match[2];
      // Rough size guard (~4/3 of base64 length ≈ bytes)
      if (Math.floor((base64.length * 3) / 4) > 5 * 1024 * 1024) {
        return "";
      }
    } else {
      const fetched = await fetchAllowlistedImage(imageUrl);
      if (!fetched) return "";
      base64 = Buffer.from(fetched.buffer).toString("base64");
      contentType = fetched.contentType;
    }

    for (const modelName of GEMINI_MODELS) {
      try {
        for (let attempt = 0; attempt < GEMINI_MAX_ATTEMPTS; attempt++) {
          const timeout = withTimeoutSignal(AI_CALL_TIMEOUT_MS);
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
              abortSignal: timeout.signal,
              providerOptions: {
                google: GEMINI_PROVIDER_SAFETY_SETTINGS,
              },
            });

            return sanitizeUserInput(result.text, { maxChars: 1_000 });
          } catch (error) {
            if (
              !isRetryableGeminiError(error) ||
              attempt === GEMINI_MAX_ATTEMPTS - 1
            ) {
              throw error;
            }

            await sleep(GEMINI_RETRY_DELAYS_MS[attempt]);
          } finally {
            timeout.clear();
          }
        }
      } catch {
        continue;
      }
    }

    return "";
  } catch {
    return "";
  }
}


/**
 * Generate an image via the multi-provider router
 * (OpenAI DALL·E 3 → Recraft → Stability → Pollinations).
 *
 * Provider API keys are used only server-side and never returned in URLs.
 */
export async function generateImage({
  prompt,
  width = 1024,
  height = 1024,
}: {
  prompt: string;
  width?: number;
  height?: number;
}): Promise<{ imageUrl: string; provider: string }> {
  const { generateImageWithRouter } = await import("@/lib/ai/image-providers");
  return generateImageWithRouter({ prompt, width, height });
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
