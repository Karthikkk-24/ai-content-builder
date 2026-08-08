import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { formatAiError } from "@/lib/ai/errors";
import {
  analyzeReferenceImage,
  generateTextWithFallback,
} from "@/lib/ai/router";
import {
  PROMPT_UPGRADE_SYSTEM,
  appendRemarks,
  buildPromptUpgradeUserMessage,
} from "@/lib/ai/prompts/prompt-upgrade";
import { moderateAiTextOutput } from "@/lib/ai/moderate";
import { sanitizeContext, sanitizeUserInput } from "@/lib/ai/sanitize";
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
import { sanitizeReferenceImageForStorage } from "@/lib/image-utils";
import { saveTextGenerationAsProject } from "@/lib/projects-from-generation";
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

    const rateLimit = await checkRateLimit(userId, "prompt-upgrade");
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit.retryAfterSeconds, requestId);
    }

    await ensureUser(userId);

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return apiError("INVALID_INPUT", "Invalid input", 400, requestId);
    }

    const { prompt, context, referenceImageUrl, remarks } = parsed.data;
    const sanitizedPrompt = sanitizeUserInput(prompt, { maxChars: 2_000 });
    const sanitizedContext = sanitizeContext(context);

    let referenceDescription = "";
    if (referenceImageUrl) {
      referenceDescription = await analyzeReferenceImage(referenceImageUrl);
    }

    const userMessage = appendRemarks(
      buildPromptUpgradeUserMessage(sanitizedPrompt, {
        generationType: sanitizedContext.generationType,
        tone: sanitizedContext.tone,
        audience: sanitizedContext.audience,
        platform: sanitizedContext.platform,
        referenceDescription,
      }),
      remarks
    );

    const { text } = await generateTextWithFallback({
      system: PROMPT_UPGRADE_SYSTEM,
      prompt: userMessage,
    });

    const moderated = moderateAiTextOutput(text, "prompt_upgrade");
    if (moderated.blocked) {
      return apiError(
        "AI_FAILED",
        moderated.reason || "Output blocked by content moderation.",
        422,
        requestId
      );
    }

    await db.insert(generations).values({
      userId,
      type: "prompt_upgrade",
      inputPrompt: sanitizedPrompt,
      outputContent: moderated.text,
      referenceImageUrl: sanitizeReferenceImageForStorage(referenceImageUrl),
      metadata: {
        context: sanitizedContext,
        remarks: remarks ?? null,
        moderated: {
          truncated: moderated.truncated,
          strippedHtml: moderated.strippedHtml,
        },
      },
    });

    await invalidateUserCache(userId);
    await saveTextGenerationAsProject({
      userId,
      type: "prompt_upgrade",
      prompt: sanitizedPrompt,
      output: moderated.text,
    });

    logAction({
      requestId,
      action: "ai.prompt_upgrade",
      userId,
      outcome: "success",
    });

    return apiSuccess(
      {
        original: prompt,
        enhanced: moderated.text,
      },
      requestId
    );
  } catch (error) {
    console.error("Prompt upgrade error:", error);
    return apiError("AI_FAILED", formatAiError(error), 500, requestId);
  }
}
