import { NextResponse } from "next/server";

import {
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
} from "@/lib/firebase/session-cookie";
import { verifyFirebaseIdTokenEdge } from "@/lib/firebase/verify-token-edge";
import {
  assertSessionPostAllowedByIp,
  getClientIpFromRequest,
} from "@/lib/upstash-rate-limit";
import { isTrustedMutationOrigin } from "@/lib/request-origin";
import { forbidden } from "@/server/_responses";

export const runtime = "nodejs";

function isSecureRequest(req: Request): boolean {
  const url = new URL(req.url);
  if (url.protocol === "https:") return true;
  const forwarded = req.headers.get("x-forwarded-proto");
  return forwarded?.split(",")[0]?.trim() === "https";
}

/**
 * Stores a verified Firebase ID token in an HttpOnly cookie.
 * App user rows are provisioned in GET /api/auth/me — not here — so sign-in
 * does not depend on Postgres during the cookie step.
 */
async function establishFirebaseSessionCookie(req: Request, idToken: string) {
  const decoded = await verifyFirebaseIdTokenEdge(idToken);
  if (!decoded?.sub) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true, uid: decoded.sub });
  res.cookies.set(
    SESSION_COOKIE_NAME,
    idToken,
    sessionCookieOptions(isSecureRequest(req)),
  );
  return res;
}

export async function POST(req: Request) {
  if (!isTrustedMutationOrigin(req)) {
    return forbidden("Untrusted origin");
  }

  const ip = getClientIpFromRequest(req);
  const rate = await assertSessionPostAllowedByIp(ip);
  if (!rate.ok) {
    return NextResponse.json(
      { error: "Too many sign-in attempts. Please try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSec) },
      },
    );
  }

  const body = await req.json().catch(() => null);
  const idToken =
    body && typeof body.idToken === "string" ? body.idToken.trim() : "";
  if (!idToken) {
    return NextResponse.json({ error: "Missing idToken" }, { status: 400 });
  }

  return establishFirebaseSessionCookie(req, idToken);
}

export async function DELETE(req: Request) {
  if (!isTrustedMutationOrigin(req)) {
    return forbidden("Untrusted origin");
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE_NAME, "", {
    ...sessionCookieOptions(isSecureRequest(req)),
    maxAge: 0,
  });
  return res;
}

export async function PATCH(req: Request) {
  return POST(req);
}
