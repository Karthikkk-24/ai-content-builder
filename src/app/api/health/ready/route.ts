import { NextResponse } from "next/server";
import { checkDatabase, checkRedis } from "@/lib/health";

/** Readiness: DB + Redis must be reachable. */
export async function GET() {
  const [database, redis] = await Promise.all([
    checkDatabase(),
    checkRedis(),
  ]);

  const ready = database.ok && redis.ok;

  return NextResponse.json(
    {
      status: ready ? "ready" : "not_ready",
      timestamp: new Date().toISOString(),
      checks: {
        database,
        redis,
      },
    },
    {
      status: ready ? 200 : 503,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
