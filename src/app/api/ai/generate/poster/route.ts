import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { formatAiError } from "@/lib/ai/errors";
import {
  analyzeReferenceImage,
  generateImage,
  generateTextWithFallback,
  getAspectDimensions,
} from "@/lib/ai/router";
import {
  appendRemarks,
  buildPosterSystemPrompt,
} from "@/lib/ai/prompts/prompt-upgrade";
import {
  apiError,
  apiSuccess,
  getRequestId,
  logAction,
} from "@/lib/api/response";
import { invalidateUserCache } from "@/lib/cache";
import { db } from "@/lib/db";
import { generations } from "@/lib/db/schema";
import { ensureUser } from "@/lib/db/users";
import {
  sanitizeGeneratedOutputForStorage,
  sanitizeReferenceImageForStorage,
} from "@/lib/image-utils";
import { saveImageGenerationAsProject } from "@/lib/projects-from-generation";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

const schema = z.object({
  prompt: z.string().min(1),
  context: z.record(z.string(), z.string()).optional(),
  referenceImageUrl: z.string().nullable().optional(),
  remarks: z.string().optional(),
});

export async function POST(req: Request) {
  const requestId = getRequestId(req);

  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("UNAUTHORIZED", "Unauthorized", 401, requestId);
    }

    if (!(await checkRateLimit(userId))) {
      return rateLimitResponse(requestId);
    }

    await ensureUser(userId);

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return apiError("INVALID_INPUT", "Invalid input", 400, requestId);
    }

    const { prompt, context, referenceImageUrl, remarks } = parsed.data;
    const promptWithRemarks = appendRemarks(prompt, remarks);

    let imagePrompt = promptWithRemarks;
    if (referenceImageUrl) {
      const refDesc = await analyzeReferenceImage(referenceImageUrl);
      if (refDesc) {
        imagePrompt = `${promptWithRemarks}. Reference style: ${refDesc}`;
      }
    } else {
      const { text } = await generateTextWithFallback({
        system: buildPosterSystemPrompt({
          style: context?.style,
          aspectRatio: context?.aspectRatio,
        }),
        prompt: promptWithRemarks,
      });
      imagePrompt = text;
    }

    const { width, height } = getAspectDimensions(context?.aspectRatio || "1:1");
    const { imageUrl, provider } = await generateImage({
      prompt: imagePrompt,
      width,
      height,
    });

    await db.insert(generations).values({
      userId,
      type: "poster",
      inputPrompt: prompt,
      outputContent: sanitizeGeneratedOutputForStorage(imageUrl),
      referenceImageUrl: sanitizeReferenceImageForStorage(referenceImageUrl),
      metadata: { context, provider, remarks: remarks ?? null },
    });

    await invalidateUserCache(userId);
    await saveImageGenerationAsProject({
      userId,
      type: "poster",
      prompt,
      imageUrl,
    });

    logAction({
      requestId,
      action: "ai.poster_generate",
      userId,
      outcome: "success",
    });

    return apiSuccess({ output: imageUrl }, requestId);
  } catch (error) {
    console.error("Poster generation error:", error);
    return apiError("AI_FAILED", formatAiError(error), 500, requestId);
  }
}
