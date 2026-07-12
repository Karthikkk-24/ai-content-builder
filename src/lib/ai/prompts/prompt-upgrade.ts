export const PROMPT_UPGRADE_SYSTEM = `You are an expert prompt engineer. Your job is to take a user's rough prompt and transform it into a detailed, descriptive prompt that will produce more accurate AI generation results.

When enhancing the prompt, include:
- Subject and main focus
- Style and aesthetic (if applicable)
- Lighting, composition, and mood
- Color palette preferences
- Technical details (aspect ratio hints, quality descriptors)
- Negative constraints (what to avoid)
- Platform-specific formatting if context is provided

Return ONLY the enhanced prompt text. Do not include explanations, prefixes, or markdown formatting.`;

export function buildPromptUpgradeUserMessage(
  prompt: string,
  context?: {
    tone?: string;
    audience?: string;
    platform?: string;
    generationType?: string;
    referenceDescription?: string;
  }
) {
  let message = `Original prompt:\n${prompt}`;

  if (context?.generationType) {
    message += `\n\nGeneration type: ${context.generationType}`;
  }
  if (context?.tone) {
    message += `\nTone: ${context.tone}`;
  }
  if (context?.audience) {
    message += `\nAudience: ${context.audience}`;
  }
  if (context?.platform) {
    message += `\nPlatform: ${context.platform}`;
  }
  if (context?.referenceDescription) {
    message += `\n\nReference image description (match this style/composition):\n${context.referenceDescription}`;
  }

  return message;
}

export function buildTweetSystemPrompt(context?: {
  tone?: string;
  audience?: string;
  threadMode?: boolean;
}) {
  const threadNote = context?.threadMode
    ? "Generate a Twitter/X thread with 3-5 tweets. Number each tweet. Keep each under 280 characters."
    : "Generate a single tweet under 280 characters.";

  return `You are a social media copywriter. ${threadNote}
Tone: ${context?.tone || "professional"}
Audience: ${context?.audience || "general"}
Return only the tweet(s), no explanations.`;
}

export function buildPosterSystemPrompt(context?: {
  style?: string;
  aspectRatio?: string;
}) {
  return `You are creating a detailed image generation prompt for a poster design.
Style: ${context?.style || "modern minimalist"}
Aspect ratio: ${context?.aspectRatio || "1:1"}
Include typography placement hints, color scheme, and visual hierarchy.
Return only the image generation prompt, no explanations.`;
}

export function buildPhotoSystemPrompt(context?: {
  style?: string;
  negativePrompt?: string;
}) {
  return `You are creating a detailed image generation prompt for photorealistic imagery.
Style: ${context?.style || "photorealistic"}
${context?.negativePrompt ? `Avoid: ${context.negativePrompt}` : ""}
Return only the image generation prompt, no explanations.`;
}

export function appendRemarks(message: string, remarks?: string) {
  if (!remarks?.trim()) {
    return message;
  }

  return `${message}\n\nUser remarks for this regeneration (incorporate these):\n${remarks.trim()}`;
}
