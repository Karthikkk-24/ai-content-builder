import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { formatAiError } from "@/lib/ai/errors";
import { invalidateUserCache } from "@/lib/cache";
import { generateTextWithFallback } from "@/lib/ai/router";
import { buildTweetSystemPrompt, appendRemarks } from "@/lib/ai/prompts/prompt-upgrade";
import { db } from "@/lib/db";
import { generations } from "@/lib/db/schema";
import { ensureUser } from "@/lib/db/users";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

const schema = z.object({
  prompt: z.string().min(1),
  context: z.record(z.string(), z.string()).optional(),
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

    const { prompt, context, remarks } = parsed.data;
    const generationType = context?.generationType || "tweet";

    let systemPrompt = buildTweetSystemPrompt({
      tone: context?.tone,
      audience: context?.audience,
      threadMode: context?.threadMode === "thread",
    });

    if (generationType === "blog") {
      systemPrompt =
        "You are a content strategist. Generate a detailed blog post outline with headings, subheadings, and key points for each section. Return only the outline in markdown format.";
    } else if (generationType === "caption") {
      systemPrompt = `You are a social media copywriter. Create an engaging caption for ${context?.platform || "social media"}.
Tone: ${context?.tone || "professional"}
Include relevant hashtags. Return only the caption.`;
    }

    const { text, provider } = await generateTextWithFallback({
      system: systemPrompt,
      prompt: appendRemarks(prompt, remarks),
    });

    await db.insert(generations).values({
      userId,
      type: generationType,
      inputPrompt: prompt,
      outputContent: text,
      metadata: { context, provider, remarks: remarks ?? null },
    });

    await invalidateUserCache(userId);

    return NextResponse.json({ output: text });
  } catch (error) {
    console.error("Tweet generation error:", error);
    return NextResponse.json({ error: formatAiError(error) }, { status: 500 });
  }
}
