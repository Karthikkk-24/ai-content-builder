import { handleTextGeneratePost } from "@/lib/ai/text-generate-route";

export const maxDuration = 60;

export async function POST(req: Request) {
  return handleTextGeneratePost(req, { rateLimitRoute: "tweet" });
}
