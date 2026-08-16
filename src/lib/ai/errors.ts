const QUOTA_PATTERNS = [
  /quota/i,
  /rate limit/i,
  /resource_exhausted/i,
  /too many requests/i,
];

const AUTH_PATTERNS = [
  /invalid api key/i,
  /api key.*missing/i,
  /unauthorized/i,
  /authentication/i,
];

const MODEL_PATTERNS = [
  /no longer available/i,
  /not found for api version/i,
  /not supported/i,
];

const GENERIC_AI_FAILURE =
  "AI generation failed. Please try again shortly.";

/**
 * Map provider errors to safe, user-facing messages.
 * Never return raw provider/stack text to API clients.
 */
export function formatAiError(error: unknown): string {
  const message =
    error instanceof Error ? error.message : "AI generation failed. Please try again.";

  if (QUOTA_PATTERNS.some((pattern) => pattern.test(message))) {
    return "Google AI could not complete the request after several attempts. The app will use Groq automatically when it is configured.";
  }

  if (AUTH_PATTERNS.some((pattern) => pattern.test(message))) {
    if (/groq/i.test(message) || !process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      return "AI provider is not configured. Check server configuration and try again.";
    }
    return "The AI API key is invalid or expired. Please contact the site operator.";
  }

  if (MODEL_PATTERNS.some((pattern) => pattern.test(message))) {
    return "The configured AI model is unavailable. Please try again shortly.";
  }

  if (/all text providers failed/i.test(message)) {
    return "All AI providers failed after retries. Please try again shortly.";
  }

  // Unknown provider/internal messages stay on the server (callers should log `error`).
  return GENERIC_AI_FAILURE;
}
