import { NextResponse } from "next/server";

/** Liveness: process is up. No dependency checks. */
export async function GET() {
  return NextResponse.json(
    {
      status: "live",
      timestamp: new Date().toISOString(),
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
