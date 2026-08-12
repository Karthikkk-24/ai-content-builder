import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
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
import { contentProjects, generations } from "@/lib/db/schema";
import { ensureUser } from "@/lib/db/users";

const updateSchema = z.object({
  title: projectTitleSchema.optional(),
  blocks: projectBlocksSchema.optional(),
  isPublic: z.boolean().optional(),
});

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getRequestId(req);

  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("UNAUTHORIZED", "Unauthorized", 401, requestId, { action: "auth" });
    }

    await ensureUser(userId);

    const { id } = await params;
    const [project] = await db
      .select()
      .from(contentProjects)
      .where(
        and(eq(contentProjects.id, id), eq(contentProjects.userId, userId))
      );

    if (!project) {
      return apiError("NOT_FOUND", "Project not found", 404, requestId);
    }

    return apiSuccess(project, requestId);
  } catch (error) {
    console.error("Failed to load project:", error);
    return apiError("INTERNAL_ERROR", "Failed to load project", 500, requestId);
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getRequestId(req);

  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("UNAUTHORIZED", "Unauthorized", 401, requestId, { action: "auth" });
    }

    await ensureUser(userId);

    const { id } = await params;
    const rawBody = await readJsonBody(req, PROJECT_JSON_BODY_LIMIT_BYTES);
    if (!rawBody.ok) {
      return jsonBodyErrorResponse(rawBody, requestId);
    }
    const parsed = updateSchema.safeParse(rawBody.data);
    if (!parsed.success) {
      return apiError("INVALID_INPUT", "Invalid input", 400, requestId);
    }

    const [project] = await db
      .update(contentProjects)
      .set({
        ...parsed.data,
        updatedAt: new Date(),
      })
      .where(
        and(eq(contentProjects.id, id), eq(contentProjects.userId, userId))
      )
      .returning();

    if (!project) {
      return apiError("NOT_FOUND", "Project not found", 404, requestId);
    }

    await invalidateUserCache(userId);
    logAction({
      requestId,
      action: "project.update",
      userId,
      outcome: "success",
      resource: id,
    });

    return apiSuccess(project, requestId);
  } catch (error) {
    console.error("Failed to update project:", error);
    return apiError("INTERNAL_ERROR", "Failed to update project", 500, requestId);
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getRequestId(req);

  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("UNAUTHORIZED", "Unauthorized", 401, requestId, { action: "auth" });
    }

    await ensureUser(userId);

    const { id } = await params;

    // Delete first and require a returned row so missing/foreign IDs are 404,
    // not a false success (clears generation_id FK via ON DELETE SET NULL).
    const [deleted] = await db
      .delete(contentProjects)
      .where(
        and(eq(contentProjects.id, id), eq(contentProjects.userId, userId))
      )
      .returning({
        id: contentProjects.id,
        generationId: contentProjects.generationId,
      });

    if (!deleted) {
      return apiError("NOT_FOUND", "Project not found", 404, requestId, {
        userId,
        action: "project.delete",
      });
    }

    // Erase the linked generation when present (GDPR / no orphan history).
    if (deleted.generationId) {
      await db
        .delete(generations)
        .where(
          and(
            eq(generations.id, deleted.generationId),
            eq(generations.userId, userId)
          )
        );
    }

    await invalidateUserCache(userId);
    logAction({
      requestId,
      action: "project.delete",
      userId,
      outcome: "success",
      resource: id,
      detail: deleted.generationId
        ? `deleted_generation=${deleted.generationId}`
        : undefined,
    });

    return apiSuccess({ success: true }, requestId);
  } catch (error) {
    console.error("Failed to delete project:", error);
    return apiError("INTERNAL_ERROR", "Failed to delete project", 500, requestId);
  }
}
