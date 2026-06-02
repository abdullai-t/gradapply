import { NextResponse } from "next/server";

import { getCurrentUserRole } from "@/lib/admin-auth";
import { getFirebaseAdminAuth } from "@/lib/firebase/admin";
import { log } from "@/lib/logger";
import {
  FIREBASE_SESSION_COOKIE_EXPIRES_MS,
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
} from "@/lib/firebase/session-cookie";
import { ensureAppUserFromFirebaseToken } from "@/lib/firebase/user-sync";
import { verifyFirebaseIdTokenNode } from "@/lib/firebase/verify-token";
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

async function establishSession(req: Request, idToken: string) {
  const decoded = await verifyFirebaseIdTokenNode(idToken);
  if (!decoded?.sub) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const isAdminLogin =
    new URL(req.url).searchParams.get("admin") === "1" ||
    req.headers.get("x-gradapply-admin-login") === "1";

  const appUser = await ensureAppUserFromFirebaseToken(decoded, {
    syncProfile: true,
  });

  if (isAdminLogin) {
    const role = await getCurrentUserRole(appUser.id);
    if (role !== "ADMIN" && role !== "SUPERADMIN") {
      return forbidden("Admin access required");
    }
  }

  const adminAuth = getFirebaseAdminAuth();
  let cookieValue = idToken;
  if (adminAuth) {
    try {
      cookieValue = await adminAuth.createSessionCookie(idToken, {
        expiresIn: FIREBASE_SESSION_COOKIE_EXPIRES_MS,
      });
    } catch (error) {
      log.warn("[auth/session] createSessionCookie failed; using ID token cookie", {
        error: error instanceof Error ? error.message : String(error),
      });
      cookieValue = idToken;
    }
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(
    SESSION_COOKIE_NAME,
    cookieValue,
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

  return establishSession(req, idToken);
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
