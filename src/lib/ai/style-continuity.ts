import { z } from "zod";
import { analyzeReferenceImage } from "@/lib/ai/router";
import { sanitizeUserInput } from "@/lib/ai/sanitize";

export type StyleFingerprint = {
  summary: string;
  moodWords: string[];
  dominantColors: string[];
  compositionNotes: string;
};

const fingerprintSchema = z.object({
  summary: z.string().max(500).optional(),
  moodWords: z.array(z.string().max(40)).max(12).optional(),
  dominantColors: z.array(z.string().max(40)).max(8).optional(),
  compositionNotes: z.string().max(400).optional(),
});

export const styleFingerprintInputSchema = fingerprintSchema;

/**
 * Best-effort style fingerprint from a generated/reference image.
 * Uses the existing vision describer, then lightly structures the text.
 */
export async function extractStyleFingerprint(
  imageUrl: string
): Promise<StyleFingerprint | null> {
  try {
    const description = await analyzeReferenceImage(imageUrl);
    if (!description.trim()) return null;
    return fingerprintFromDescription(description);
  } catch {
    return null;
  }
}

export function fingerprintFromDescription(description: string): StyleFingerprint {
  const cleaned = sanitizeUserInput(description, { maxChars: 1_000 }).trim();
  const moodWords = extractMoodWords(cleaned);
  const dominantColors = extractColorMentions(cleaned);

  return {
    summary: cleaned.slice(0, 400),
    moodWords,
    dominantColors,
    compositionNotes: cleaned.slice(0, 240),
  };
}

export function normalizeStyleFingerprint(
  input: unknown
): StyleFingerprint | null {
  const parsed = fingerprintSchema.safeParse(input);
  if (!parsed.success) return null;
  const summary = sanitizeUserInput(parsed.data.summary || "", {
    maxChars: 500,
  }).trim();
  if (!summary && !parsed.data.moodWords?.length) return null;

  return {
    summary: summary || "Prior generation style",
    moodWords: (parsed.data.moodWords || [])
      .map((w) => sanitizeUserInput(w, { maxChars: 40 }).trim())
      .filter(Boolean)
      .slice(0, 12),
    dominantColors: (parsed.data.dominantColors || [])
      .map((w) => sanitizeUserInput(w, { maxChars: 40 }).trim())
      .filter(Boolean)
      .slice(0, 8),
    compositionNotes: sanitizeUserInput(parsed.data.compositionNotes || "", {
      maxChars: 400,
    }).trim(),
  };
}

export function formatStyleSoftConstraints(style: StyleFingerprint): string {
  const parts = [
    "Preserve continuity with the previous generation style (soft constraints, not hard locks):",
  ];
  if (style.moodWords.length) {
    parts.push(`Mood: ${style.moodWords.join(", ")}`);
  }
  if (style.dominantColors.length) {
    parts.push(`Dominant colors: ${style.dominantColors.join(", ")}`);
  }
  if (style.compositionNotes) {
    parts.push(`Composition notes: ${style.compositionNotes}`);
  }
  if (style.summary) {
    parts.push(`Prior look summary: ${style.summary}`);
  }
  return parts.join("\n");
}

const MOOD_LEXICON = [
  "cinematic",
  "moody",
  "bright",
  "dark",
  "warm",
  "cool",
  "soft",
  "harsh",
  "vibrant",
  "muted",
  "minimal",
  "dramatic",
  "ethereal",
  "gritty",
  "pastel",
  "neon",
  "natural",
  "studio",
  "golden",
  "high-contrast",
  "low-key",
  "high-key",
];

function extractMoodWords(text: string): string[] {
  const lower = text.toLowerCase();
  return MOOD_LEXICON.filter((word) => lower.includes(word)).slice(0, 8);
}

function extractColorMentions(text: string): string[] {
  const colors: string[] = [];
  const hexes = text.match(/#([0-9a-fA-F]{3,8})\b/g) || [];
  colors.push(...hexes.slice(0, 4));
  const named =
    text.match(
      /\b(red|blue|green|yellow|orange|purple|pink|black|white|gray|grey|gold|silver|teal|cyan|magenta|brown|beige|cream|ivory)\b/gi
    ) || [];
  for (const name of named) {
    const normalized = name.toLowerCase();
    if (!colors.includes(normalized)) colors.push(normalized);
    if (colors.length >= 8) break;
  }
  return colors.slice(0, 8);
}
