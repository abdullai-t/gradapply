import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { isFirebaseConfigured } from "@/lib/firebase/config";
import { SESSION_COOKIE_NAME } from "@/lib/firebase/session-cookie";

/**
 * Edge middleware — cookie presence only (no JWT verify; avoids node:crypto on edge).
 * API routes and server layouts verify the Firebase ID token via Admin SDK / Node.
 */
export async function middleware(req: NextRequest) {
  if (!isFirebaseConfigured()) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token?.trim()) {
    const loginPath = req.nextUrl.pathname.startsWith("/admin")
      ? "/login/admin"
      : "/login";
    const url = new URL(loginPath, req.nextUrl.origin);
    url.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/onboarding",
    "/onboarding/:path*",
    "/dashboard",
    "/dashboard/:path*",
    "/schools/:path*",
    "/timeline/:path*",
    "/emails/:path*",
    "/collaboration",
    "/collaboration/:path*",
    "/assistant",
    "/assistant/:path*",
    "/ai-coach/:path*",
    "/documents/:path*",
    "/profile/:path*",
    "/settings/:path*",
    "/admin/:path*",
  ],
};
