import { NextResponse } from "next/server";

import { runHealthCheck } from "@/lib/health-check";

export async function GET() {
  const result = await runHealthCheck();

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: 503 },
    );
  }

  return NextResponse.json({
    ok: true,
    version: result.version,
    dbMs: result.dbMs,
  });
}
