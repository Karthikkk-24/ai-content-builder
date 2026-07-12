import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { invalidateUserCache } from "@/lib/cache";
import { db } from "@/lib/db";
import { contentProjects } from "@/lib/db/schema";
import { ensureUser } from "@/lib/db/users";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await ensureUser(userId);

    const projects = await db
      .select()
      .from(contentProjects)
      .where(eq(contentProjects.userId, userId));

    return NextResponse.json(projects);
  } catch {
    return NextResponse.json([]);
  }
}

const createSchema = z.object({
  title: z.string().optional(),
  blocks: z.array(z.any()).optional(),
});

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await ensureUser(userId);

    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
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

    return NextResponse.json(project);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
