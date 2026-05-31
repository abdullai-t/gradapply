import { NextResponse } from "next/server";

import { runGoogleDocsCron } from "@/lib/google-docs";

export const runtime = "nodejs";

function authorizeCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return false;
  return auth.slice("Bearer ".length) === secret;
}

export async function GET(req: Request) {
  if (!authorizeCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = await runGoogleDocsCron();
  return NextResponse.json({ ok: true, ...summary });
}

export async function POST(req: Request) {
  return GET(req);
}
