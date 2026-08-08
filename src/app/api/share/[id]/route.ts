import { and, eq } from "drizzle-orm";
import { apiError, apiSuccess, getRequestId } from "@/lib/api/response";
import { db } from "@/lib/db";
import { contentProjects } from "@/lib/db/schema";

/** Public read of a shared project (no auth). */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getRequestId(req);

  try {
    const { id } = await params;
    const [project] = await db
      .select({
        id: contentProjects.id,
        title: contentProjects.title,
        blocks: contentProjects.blocks,
        updatedAt: contentProjects.updatedAt,
      })
      .from(contentProjects)
      .where(
        and(eq(contentProjects.id, id), eq(contentProjects.isPublic, true))
      )
      .limit(1);

    if (!project) {
      return apiError("NOT_FOUND", "Shared project not found", 404, requestId);
    }

    return apiSuccess(project, requestId);
  } catch (error) {
    console.error("Failed to load shared project:", error);
    return apiError(
      "INTERNAL_ERROR",
      "Failed to load shared project",
      500,
      requestId
    );
  }
}
