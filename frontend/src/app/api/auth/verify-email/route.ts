import { NextResponse } from "next/server";

import { appOrigin } from "@/lib/app-origin";
import { consumeEmailVerificationToken } from "@/lib/email-verification";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token")?.trim() ?? "";
  const base = appOrigin();

  if (!token) {
    return NextResponse.redirect(`${base}/login?verify_error=1`);
  }

  const ok = await consumeEmailVerificationToken(token);
  return NextResponse.redirect(
    ok ? `${base}/login?verified=1` : `${base}/login?verify_error=1`,
  );
}

