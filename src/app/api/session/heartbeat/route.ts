import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { touchUserSession } from "@/lib/session";

export async function POST() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await touchUserSession(userId);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Session heartbeat failed" }, { status: 500 });
  }
}
