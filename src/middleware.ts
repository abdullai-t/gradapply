import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  if (!req.auth) {
    const url = new URL("/login", req.nextUrl.origin);
    url.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/schools/:path*",
    "/tracker/:path*",
    "/emails/:path*",
    "/assistant",
    "/assistant/:path*",
    "/ai-coach/:path*",
    "/documents/:path*",
    "/profile/:path*",
    "/settings/:path*",
  ],
};
