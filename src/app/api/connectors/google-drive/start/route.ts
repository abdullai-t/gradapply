import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/auth";
import { buildGoogleDriveAuthorizeUrl } from "@/lib/google-drive-connector";
import { signOAuthState } from "@/lib/oauth-state";

/** Redirects to Google OAuth consent for Drive API scopes. */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    const login = new URL("/login", req.url);
    login.searchParams.set("callbackUrl", "/settings");
    return NextResponse.redirect(login);
  }

  try {
    const state = signOAuthState({
      uid: session.user.id,
      exp: Date.now() + 10 * 60 * 1000,
    });
    const url = buildGoogleDriveAuthorizeUrl(state);
    return NextResponse.redirect(url);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "oauth_setup_failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
