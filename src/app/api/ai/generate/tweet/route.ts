import { handleTextGeneratePost } from "@/lib/ai/text-generate-route";

export const maxDuration = 60;

export async function POST(req: Request) {
  return handleTextGeneratePost(req, {
    rateLimitRoute: "tweet",
    // Always force tweet — never trust client context.generationType (quota/prompt abuse).
    forceGenerationType: "tweet",
  });
}
