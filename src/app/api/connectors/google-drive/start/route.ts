import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/auth";
import { appOrigin } from "@/lib/app-origin";
import { buildGoogleDriveAuthorizeUrl } from "@/lib/google-drive-connector";
import { isGoogleOAuthConfigured } from "@/lib/google-oauth-tokens";
import { signOAuthState } from "@/lib/oauth-state";
import { requireNonFreeForFeature } from "@/lib/plan-gates";

/** Redirects to Google OAuth consent for Drive API scopes. */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    const login = new URL("/login", req.url);
    login.searchParams.set("callbackUrl", "/settings");
    return NextResponse.redirect(login);
  }

  const locked = await requireNonFreeForFeature(session.user.id, "connectors");
  if (locked) return locked;

  if (!isGoogleOAuthConfigured()) {
    return NextResponse.redirect(
      `${appOrigin()}/settings?connector_error=${encodeURIComponent(
        "Google OAuth is not configured on this server (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET). Ask whoever hosts GradApply to add them. After that, each user connects their own Google account—tokens are stored only for that user.",
      )}`,
    );
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
    return NextResponse.redirect(
      `${appOrigin()}/settings?connector_error=${encodeURIComponent(msg)}`,
    );
  }
}
