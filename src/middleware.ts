import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function authSecret(): string {
  return process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "";
}

function isSecureRequest(req: NextRequest): boolean {
  if (req.nextUrl.protocol === "https:") return true;
  const forwarded = req.headers.get("x-forwarded-proto");
  if (forwarded?.split(",")[0]?.trim() === "https") return true;
  return process.env.NODE_ENV === "production";
}

/** Edge middleware — required for OpenNext on Cloudflare (Node proxy is unsupported). */
export async function middleware(req: NextRequest) {
  const secret = authSecret();
  if (!secret) {
    return NextResponse.next();
  }

  const token = await getToken({
    req,
    secret,
    secureCookie: isSecureRequest(req),
  });
  if (!token?.sub) {
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
