import { auth } from "@clerk/nextjs/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import {
  apiError,
  apiSuccess,
  getRequestId,
  logAction,
} from "@/lib/api/response";
import {
  PROJECT_JSON_BODY_LIMIT_BYTES,
  jsonBodyErrorResponse,
  readJsonBody,
} from "@/lib/api/read-json";
import { invalidateUserCache } from "@/lib/cache";
import {
  projectBlocksSchema,
  projectTitleSchema,
} from "@/lib/content-blocks";
import { db } from "@/lib/db";
import { contentProjects } from "@/lib/db/schema";
import { ensureUser } from "@/lib/db/users";
import { syncGenerationsToProjects } from "@/lib/projects-from-generation";
import { parseLimitParam } from "@/lib/api/parse-limit";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

const createSchema = z.object({
  title: projectTitleSchema.optional(),
  blocks: projectBlocksSchema.optional(),
});

export async function GET(req: Request) {
  const requestId = getRequestId(req);

  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("UNAUTHORIZED", "Unauthorized", 401, requestId, { action: "auth" });
    }

    await ensureUser(userId);

    const { searchParams } = new URL(req.url);
    const limit = parseLimitParam(searchParams.get("limit"), {
      defaultLimit: DEFAULT_LIMIT,
      maxLimit: MAX_LIMIT,
    });

    // Incremental sync of generations that were never linked to a project.
    // Safe because sync only inserts rows with null generation_id join matches.
    await syncGenerationsToProjects(userId);

    const projects = await db
      .select()
      .from(contentProjects)
      .where(eq(contentProjects.userId, userId))
      .orderBy(desc(contentProjects.updatedAt))
      .limit(limit);

    return apiSuccess(projects, requestId);
  } catch (error) {
    console.error("Failed to load projects:", error);
    return apiError("INTERNAL_ERROR", "Failed to load projects", 500, requestId);
  }
}

export async function POST(req: Request) {
  const requestId = getRequestId(req);

  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("UNAUTHORIZED", "Unauthorized", 401, requestId, { action: "auth" });
    }

    await ensureUser(userId);

    const rawBody = await readJsonBody(req, PROJECT_JSON_BODY_LIMIT_BYTES);
    if (!rawBody.ok) {
      return jsonBodyErrorResponse(rawBody, requestId);
    }
    const parsed = createSchema.safeParse(rawBody.data);
    if (!parsed.success) {
      return apiError("INVALID_INPUT", "Invalid input", 400, requestId);
    }

    const [project] = await db
      .insert(contentProjects)
      .values({
        userId,
        title: parsed.data.title || "Untitled",
        blocks: parsed.data.blocks || [],
      })
      .returning();

    await invalidateUserCache(userId);
    logAction({
      requestId,
      action: "project.create",
      userId,
      outcome: "success",
      resource: project.id,
    });

    return apiSuccess(project, requestId, { status: 201 });
  } catch (error) {
    console.error("Failed to create project:", error);
    return apiError("INTERNAL_ERROR", "Failed to create project", 500, requestId);
  }
}
