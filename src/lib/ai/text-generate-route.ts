import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { formatAiError } from "@/lib/ai/errors";
import {
  generateAndPersistText,
  streamAndPersistTextResponse,
} from "@/lib/ai/text-generation";
import {
  apiError,
  apiSuccess,
  getRequestId,
  logAction,
} from "@/lib/api/response";
import {
  AI_JSON_BODY_LIMIT_BYTES,
  jsonBodyErrorResponse,
  readJsonBody,
} from "@/lib/api/read-json";
import { ensureUser } from "@/lib/db/users";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

const schema = z.object({
  prompt: z.string().min(1),
  context: z.record(z.string(), z.string()).optional(),
  remarks: z.string().optional(),
  referenceImageUrl: z.string().nullable().optional(),
  stream: z.boolean().optional(),
});

/** Merge client context with a server-forced generationType (server wins). */
export function mergeForcedGenerationContext(
  context: Record<string, string> | undefined,
  forceGenerationType?: string
): Record<string, string> {
  return {
    ...(context || {}),
    ...(forceGenerationType ? { generationType: forceGenerationType } : {}),
  };
}

export async function handleTextGeneratePost(
  req: Request,
  options: {
    rateLimitRoute: string;
    /** When set, overwrites context.generationType before generation. */
    forceGenerationType?: string;
  }
) {
  const requestId = getRequestId(req);

  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("UNAUTHORIZED", "Unauthorized", 401, requestId, {
        action: "auth",
      });
    }

    const rateLimit = await checkRateLimit(userId, options.rateLimitRoute);
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit.retryAfterSeconds, requestId, userId);
    }

    await ensureUser(userId);

    const rawBody = await readJsonBody(req, AI_JSON_BODY_LIMIT_BYTES);
    if (!rawBody.ok) {
      return jsonBodyErrorResponse(rawBody, requestId);
    }
    const parsed = schema.safeParse(rawBody.data);
    if (!parsed.success) {
      return apiError("INVALID_INPUT", "Invalid input", 400, requestId);
    }

    const { prompt, context, remarks, referenceImageUrl, stream } = parsed.data;
    const mergedContext = mergeForcedGenerationContext(
      context,
      options.forceGenerationType
    );

    const wantsStream =
      stream === true ||
      (req.headers.get("accept") || "").includes("text/event-stream");

    if (wantsStream) {
      try {
        const response = await streamAndPersistTextResponse({
          userId,
          prompt,
          context: mergedContext,
          remarks,
          referenceImageUrl,
          requestId,
        });
        logAction({
          requestId,
          action: "ai.text_generate_stream",
          userId,
          outcome: "success",
          resource: options.forceGenerationType || mergedContext.generationType || "tweet",
        });
        return response;
      } catch (streamError) {
        console.warn(
          "Streaming failed to open; falling back to non-stream:",
          streamError
        );
        // Fall through to non-stream path.
      }
    }

    const { text, generationType } = await generateAndPersistText({
      userId,
      prompt,
      context: mergedContext,
      remarks,
      referenceImageUrl,
    });

    logAction({
      requestId,
      action: "ai.text_generate",
      userId,
      outcome: "success",
      resource: generationType,
    });

    return apiSuccess({ output: text }, requestId);
  } catch (error) {
    console.error("Text generation error:", error);
    return apiError("AI_FAILED", formatAiError(error), 500, requestId);
  }
}
