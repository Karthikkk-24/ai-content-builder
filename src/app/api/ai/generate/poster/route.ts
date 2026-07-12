import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  analyzeReferenceImage,
  generateImage,
  generateTextWithFallback,
  getAspectDimensions,
} from "@/lib/ai/router";
import { buildPosterSystemPrompt } from "@/lib/ai/prompts/prompt-upgrade";
import { db } from "@/lib/db";
import { generations } from "@/lib/db/schema";
import { ensureUser } from "@/lib/db/users";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

const schema = z.object({
  prompt: z.string().min(1),
  context: z.record(z.string(), z.string()).optional(),
  referenceImageUrl: z.string().nullable().optional(),
});

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!checkRateLimit(userId)) {
      return rateLimitResponse();
    }

    await ensureUser(userId);

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const { prompt, context, referenceImageUrl } = parsed.data;

    let imagePrompt = prompt;
    if (referenceImageUrl) {
      const refDesc = await analyzeReferenceImage(referenceImageUrl);
      if (refDesc) {
        imagePrompt = `${prompt}. Reference style: ${refDesc}`;
      }
    } else {
      const { text } = await generateTextWithFallback({
        system: buildPosterSystemPrompt({
          style: context?.style,
          aspectRatio: context?.aspectRatio,
        }),
        prompt,
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
      outputContent: imageUrl,
      referenceImageUrl: referenceImageUrl ?? null,
      metadata: { context, provider },
    });

    return NextResponse.json({ output: imageUrl });
  } catch (error) {
    console.error("Poster generation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
