import { analyzeReferenceImage, generateTextWithFallback } from "@/lib/ai/router";
import {
  appendRemarks,
  buildTweetSystemPrompt,
} from "@/lib/ai/prompts/prompt-upgrade";
import { invalidateUserCache } from "@/lib/cache";
import { db } from "@/lib/db";
import { generations } from "@/lib/db/schema";
import { saveTextGenerationAsProject } from "@/lib/projects-from-generation";

export type TextGenerationContext = Record<string, string>;

function buildSystemPrompt(
  generationType: string,
  context?: TextGenerationContext
): string {
  if (generationType === "blog") {
    return `You are a content strategist. Generate a detailed blog post outline with headings, subheadings, and key points for each section.
Tone: ${context?.tone || "informative"}
Audience: ${context?.audience || "general"}
Return only the outline in markdown format.`;
  }

  if (generationType === "caption") {
    return `You are a social media copywriter. Create an engaging caption for ${context?.platform || "social media"}.
Tone: ${context?.tone || "professional"}
Include relevant hashtags. Return only the caption.`;
  }

  return buildTweetSystemPrompt({
    tone: context?.tone,
    audience: context?.audience,
    threadMode: context?.threadMode === "thread",
  });
}

export async function generateAndPersistText({
  userId,
  prompt,
  context,
  remarks,
  referenceImageUrl,
}: {
  userId: string;
  prompt: string;
  context?: TextGenerationContext;
  remarks?: string;
  referenceImageUrl?: string | null;
}): Promise<{ text: string; provider: string; generationType: string }> {
  const generationType = context?.generationType || "tweet";
  let enrichedPrompt = appendRemarks(prompt, remarks);

  if (referenceImageUrl) {
    const referenceDescription = await analyzeReferenceImage(referenceImageUrl);
    if (referenceDescription) {
      enrichedPrompt = `${enrichedPrompt}\n\nReference image description:\n${referenceDescription}`;
    }
  }

  const { text, provider } = await generateTextWithFallback({
    system: buildSystemPrompt(generationType, context),
    prompt: enrichedPrompt,
  });

  await db.insert(generations).values({
    userId,
    type: generationType,
    inputPrompt: prompt,
    outputContent: text,
    metadata: {
      context,
      provider,
      remarks: remarks ?? null,
      hasReferenceImage: Boolean(referenceImageUrl),
    },
  });

  await invalidateUserCache(userId);
  await saveTextGenerationAsProject({
    userId,
    type: generationType,
    prompt,
    output: text,
  });

  return { text, provider, generationType };
}
