import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { formatAiError } from "@/lib/ai/errors";
import { invalidateUserCache } from "@/lib/cache";
import {
  analyzeReferenceImage,
  generateTextWithFallback,
} from "@/lib/ai/router";
import {
  PROMPT_UPGRADE_SYSTEM,
  appendRemarks,
  buildPromptUpgradeUserMessage,
} from "@/lib/ai/prompts/prompt-upgrade";
import { db } from "@/lib/db";
import { generations } from "@/lib/db/schema";
import { ensureUser } from "@/lib/db/users";
import { saveTextGenerationAsProject } from "@/lib/projects-from-generation";
import { sanitizeReferenceImageForStorage } from "@/lib/image-utils";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

const schema = z.object({
  prompt: z.string().min(1),
  context: z.record(z.string(), z.string()).optional(),
  referenceImageUrl: z.string().nullable().optional(),
  remarks: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!(await checkRateLimit(userId))) {
      return rateLimitResponse();
    }

    await ensureUser(userId);

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const { prompt, context, referenceImageUrl, remarks } = parsed.data;

    let referenceDescription = "";
    if (referenceImageUrl) {
      referenceDescription = await analyzeReferenceImage(referenceImageUrl);
    }

    const userMessage = appendRemarks(
      buildPromptUpgradeUserMessage(prompt, {
        ...context,
        referenceDescription,
      }),
      remarks
    );

    const { text } = await generateTextWithFallback({
      system: PROMPT_UPGRADE_SYSTEM,
      prompt: userMessage,
    });

    await db.insert(generations).values({
      userId,
      type: "prompt_upgrade",
      inputPrompt: prompt,
      outputContent: text,
      referenceImageUrl: sanitizeReferenceImageForStorage(referenceImageUrl),
      metadata: { context, remarks: remarks ?? null },
    });

    await invalidateUserCache(userId);
    await saveTextGenerationAsProject({
      userId,
      type: "prompt_upgrade",
      prompt,
      output: text,
    });

    return NextResponse.json({
      original: prompt,
      enhanced: text,
    });
  } catch (error) {
    console.error("Prompt upgrade error:", error);
    return NextResponse.json({ error: formatAiError(error) }, { status: 500 });
  }
}
