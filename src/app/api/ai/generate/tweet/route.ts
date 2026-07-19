import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { formatAiError } from "@/lib/ai/errors";
import { generateAndPersistText } from "@/lib/ai/text-generation";
import {
  apiError,
  apiSuccess,
  getRequestId,
  logAction,
} from "@/lib/api/response";
import { ensureUser } from "@/lib/db/users";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

const schema = z.object({
  prompt: z.string().min(1),
  context: z.record(z.string(), z.string()).optional(),
  remarks: z.string().optional(),
  referenceImageUrl: z.string().nullable().optional(),
});

export async function POST(req: Request) {
  const requestId = getRequestId(req);

  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("UNAUTHORIZED", "Unauthorized", 401, requestId);
    }

    if (!(await checkRateLimit(userId))) {
      return rateLimitResponse();
    }

    await ensureUser(userId);

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return apiError("INVALID_INPUT", "Invalid input", 400, requestId);
    }

    const { prompt, context, remarks, referenceImageUrl } = parsed.data;
    const { text, generationType } = await generateAndPersistText({
      userId,
      prompt,
      context,
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
