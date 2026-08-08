import { scrubProviderSecretsFromUrl } from "@/lib/image-utils";

/**
 * Post-generation output moderation.
 *
 * Provider safety settings reduce risk at generation time; this layer enforces
 * length caps and strips HTML/script-like payloads before we persist or return
 * model output to clients.
 */

export const OUTPUT_CHAR_LIMITS = {
  tweet: 280,
  blog: 12_000,
  caption: 2_200,
  prompt_upgrade: 4_000,
  photo: 0, // image URL — validated separately
  poster: 0,
  default: 8_000,
} as const;

const HTML_TAG_REGEX = /<\/?[a-z][\s\S]*?>/gi;
const SCRIPT_LIKE_REGEX =
  /(?:javascript:|vbscript:|data:text\/html|on\w+\s*=|<script|<iframe|<object|<embed|<link|<meta)/gi;

export type ModeratedText = {
  text: string;
  truncated: boolean;
  strippedHtml: boolean;
  blocked: boolean;
  reason?: string;
};

function limitForType(generationType: string): number {
  if (generationType in OUTPUT_CHAR_LIMITS) {
    const limit =
      OUTPUT_CHAR_LIMITS[generationType as keyof typeof OUTPUT_CHAR_LIMITS];
    if (typeof limit === "number" && limit > 0) return limit;
  }
  return OUTPUT_CHAR_LIMITS.default;
}

/**
 * Moderate AI text before persistence / client return.
 * Returns `blocked: true` when the payload is dominated by executable markup.
 */
export function moderateAiTextOutput(
  raw: string,
  generationType = "default"
): ModeratedText {
  if (typeof raw !== "string" || raw.length === 0) {
    return { text: "", truncated: false, strippedHtml: false, blocked: false };
  }

  let text = raw.normalize("NFC").replace(/\u0000/g, "");
  const scriptHits = text.match(SCRIPT_LIKE_REGEX)?.length ?? 0;
  const htmlHits = text.match(HTML_TAG_REGEX)?.length ?? 0;

  // If the model returned mostly executable markup, refuse rather than store.
  if (scriptHits >= 2 || (scriptHits >= 1 && htmlHits >= 5)) {
    return {
      text: "",
      truncated: false,
      strippedHtml: true,
      blocked: true,
      reason: "Output blocked by content moderation (unsafe markup).",
    };
  }

  let strippedHtml = false;
  if (htmlHits > 0 || scriptHits > 0) {
    text = text
      .replace(SCRIPT_LIKE_REGEX, " ")
      .replace(HTML_TAG_REGEX, " ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/ {2,}/g, " ")
      .trim();
    strippedHtml = true;
  }

  const maxChars = limitForType(generationType);
  let truncated = false;
  if (text.length > maxChars) {
    text = text.slice(0, maxChars).trimEnd();
    truncated = true;
  }

  return { text, truncated, strippedHtml, blocked: false };
}

/**
 * Validate generated image outputs: scrub secrets, allow only https or data:image.
 */
export function moderateAiImageOutput(rawUrl: string): {
  url: string;
  blocked: boolean;
  reason?: string;
} {
  if (typeof rawUrl !== "string" || !rawUrl) {
    return {
      url: "",
      blocked: true,
      reason: "Empty image output.",
    };
  }

  const url = scrubProviderSecretsFromUrl(rawUrl);

  if (url.startsWith("data:image/")) {
    // Reject non-image data URLs that somehow slipped through scrubbing.
    if (/data:image\/(?:svg\+xml)/i.test(url)) {
      return {
        url: "",
        blocked: true,
        reason: "SVG data URLs are not allowed for generated images.",
      };
    }
    return { url, blocked: false };
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") {
      return {
        url: "",
        blocked: true,
        reason: "Generated image URL must use HTTPS.",
      };
    }
    return { url: parsed.toString(), blocked: false };
  } catch {
    return {
      url: "",
      blocked: true,
      reason: "Generated image URL is invalid.",
    };
  }
}
