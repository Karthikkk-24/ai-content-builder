import { auth } from "@clerk/nextjs/server";
import { desc, eq } from "drizzle-orm";
import {
  apiError,
  getRequestId,
  logAction,
} from "@/lib/api/response";
import { ensureUser } from "@/lib/db/users";
import { db } from "@/lib/db";
import {
  contentProjects,
  generations,
  referenceImages,
  users,
} from "@/lib/db/schema";
import { getUserPreferences } from "@/lib/preferences";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

/** Per-table cap so export cannot load unbounded history in one response. */
export const MAX_ACCOUNT_EXPORT_ROWS = 1_000;

/** Lax cookies are sent on cross-site top-level GET; export is POST-only. */
export async function GET(req: Request) {
  const requestId = getRequestId(req);
  const response = apiError(
    "INVALID_INPUT",
    "Use POST to export account data",
    405,
    requestId,
    { action: "account.export" }
  );
  response.headers.set("Allow", "POST");
  return response;
}

export async function POST(req: Request) {
  const requestId = getRequestId(req);

  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("UNAUTHORIZED", "Unauthorized", 401, requestId, {
        action: "account.export",
      });
    }

    const rateLimit = await checkRateLimit(userId, "export");
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit.retryAfterSeconds, requestId, userId);
    }

    await ensureUser(userId);

    const [profile] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const [prefs, userProjects, userGenerations, userRefs] = await Promise.all([
      getUserPreferences(userId),
      db
        .select()
        .from(contentProjects)
        .where(eq(contentProjects.userId, userId))
        .orderBy(desc(contentProjects.updatedAt))
        .limit(MAX_ACCOUNT_EXPORT_ROWS),
      db
        .select()
        .from(generations)
        .where(eq(generations.userId, userId))
        .orderBy(desc(generations.createdAt))
        .limit(MAX_ACCOUNT_EXPORT_ROWS),
      db
        .select({
          id: referenceImages.id,
          url: referenceImages.url,
          fileName: referenceImages.fileName,
          createdAt: referenceImages.createdAt,
        })
        .from(referenceImages)
        .where(eq(referenceImages.userId, userId))
        .orderBy(desc(referenceImages.createdAt))
        .limit(MAX_ACCOUNT_EXPORT_ROWS),
    ]);

    const payload = {
      exportedAt: new Date().toISOString(),
      truncated: {
        projects: userProjects.length >= MAX_ACCOUNT_EXPORT_ROWS,
        generations: userGenerations.length >= MAX_ACCOUNT_EXPORT_ROWS,
        referenceImages: userRefs.length >= MAX_ACCOUNT_EXPORT_ROWS,
        maxRows: MAX_ACCOUNT_EXPORT_ROWS,
      },
      profile: profile
        ? {
            id: profile.id,
            email: profile.email,
            name: profile.name,
            avatarUrl: profile.avatarUrl,
            createdAt: profile.createdAt,
          }
        : null,
      preferences: prefs,
      projects: userProjects,
      generations: userGenerations,
      referenceImages: userRefs,
    };

    logAction({
      requestId,
      action: "account.export",
      userId,
      outcome: "success",
      detail: `projects=${userProjects.length};generations=${userGenerations.length}`,
    });

    return new Response(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="contentai-export-${userId.slice(0, 8)}.json"`,
        "x-request-id": requestId,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Failed to export account data:", error);
    return apiError(
      "INTERNAL_ERROR",
      "Failed to export account data",
      500,
      requestId,
      { action: "account.export" }
    );
  }
}
