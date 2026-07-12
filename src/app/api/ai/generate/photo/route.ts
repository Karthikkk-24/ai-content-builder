import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  analyzeReferenceImage,
  generateImage,
  generateTextWithFallback,
} from "@/lib/ai/router";
import { buildPhotoSystemPrompt } from "@/lib/ai/prompts/prompt-upgrade";
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
        imagePrompt = `${prompt}. Match this reference composition and style: ${refDesc}`;
      }
    } else {
      const { text } = await generateTextWithFallback({
        system: buildPhotoSystemPrompt({
          style: context?.style,
          negativePrompt: context?.negativePrompt,
        }),
        prompt,
      });
      imagePrompt = text;
    }

    const { imageUrl, provider } = await generateImage({ prompt: imagePrompt });

    await db.insert(generations).values({
      userId,
      type: "photo",
      inputPrompt: prompt,
      outputContent: imageUrl,
      referenceImageUrl: referenceImageUrl ?? null,
      metadata: { context, provider },
    });

    return NextResponse.json({ output: imageUrl });
  } catch (error) {
    console.error("Photo generation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
