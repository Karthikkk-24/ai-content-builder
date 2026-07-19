import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import {
  apiError,
  apiSuccess,
  getRequestId,
  logAction,
} from "@/lib/api/response";
import { invalidateUserCache } from "@/lib/cache";
import { db } from "@/lib/db";
import { contentProjects } from "@/lib/db/schema";
import { ensureUser } from "@/lib/db/users";

const updateSchema = z.object({
  title: z.string().optional(),
  blocks: z.array(z.any()).optional(),
});

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getRequestId(req);

  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("UNAUTHORIZED", "Unauthorized", 401, requestId);
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
      return apiError("UNAUTHORIZED", "Unauthorized", 401, requestId);
    }

    await ensureUser(userId);

    const { id } = await params;
    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
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
      return apiError("UNAUTHORIZED", "Unauthorized", 401, requestId);
    }

    await ensureUser(userId);

    const { id } = await params;
    await db
      .delete(contentProjects)
      .where(
        and(eq(contentProjects.id, id), eq(contentProjects.userId, userId))
      );

    await invalidateUserCache(userId);
    logAction({
      requestId,
      action: "project.delete",
      userId,
      outcome: "success",
      resource: id,
    });

    return apiSuccess({ success: true }, requestId);
  } catch (error) {
    console.error("Failed to delete project:", error);
    return apiError("INTERNAL_ERROR", "Failed to delete project", 500, requestId);
  }
}
