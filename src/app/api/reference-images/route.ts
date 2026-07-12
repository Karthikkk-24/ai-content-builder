import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { referenceImages } from "@/lib/db/schema";
import { ensureUser } from "@/lib/db/users";

const schema = z.object({
  url: z.string().url(),
  fileName: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    await ensureUser(userId);

    const [image] = await db
      .insert(referenceImages)
      .values({
        userId,
        url: parsed.data.url,
        fileName: parsed.data.fileName,
      })
      .returning();

    return NextResponse.json(image);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
