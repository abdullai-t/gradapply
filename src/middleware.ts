import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function authSecret(): string {
  return process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "";
}

export default async function middleware(req: NextRequest) {
  const secret = authSecret();
  if (!secret) {
    return NextResponse.next();
  }

  const token = await getToken({ req, secret });
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
    "/dashboard/:path*",
    "/schools/:path*",
    "/timeline/:path*",
    "/emails/:path*",
    "/assistant",
    "/assistant/:path*",
    "/ai-coach/:path*",
    "/documents/:path*",
    "/profile/:path*",
    "/settings/:path*",
    "/admin/:path*",
  ],
};
