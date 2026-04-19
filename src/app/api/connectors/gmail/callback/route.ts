import { NextResponse } from "next/server";
import { ConnectorProvider } from "@prisma/client";

import { auth } from "@/auth";
import { appOrigin } from "@/lib/app-origin";
import {
  exchangeCodeForTokens,
  fetchGmailProfileEmail,
  GMAIL_CONNECTOR_SCOPES,
} from "@/lib/gmail-connector";
import { verifyOAuthState } from "@/lib/oauth-state";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await auth();
  const url = new URL(req.url);
  const oauthErr = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const origin = appOrigin();

  const redirectErr = (msg: string) =>
    NextResponse.redirect(
      `${origin}/settings?connector_error=${encodeURIComponent(msg)}`,
    );

  if (oauthErr) return redirectErr(oauthErr);
  if (!session?.user?.id) return redirectErr("not_signed_in");
  if (!code?.trim() || !state?.trim()) return redirectErr("missing_oauth_params");

  const payload = verifyOAuthState(state);
  const uid = typeof payload?.uid === "string" ? payload.uid : null;
  if (!uid || uid !== session.user.id) return redirectErr("invalid_state");

  try {
    const tokens = await exchangeCodeForTokens(code);

    const existing = await prisma.connector.findUnique({
      where: {
        userId_provider: {
          userId: uid,
          provider: ConnectorProvider.GMAIL,
        },
      },
    });

    const refreshToken =
      tokens.refresh_token?.trim() || existing?.refreshToken?.trim() || "";
    if (!refreshToken) {
      return redirectErr(
        "Google did not return a refresh token. Try disconnecting and connecting again, or remove the GradApply app from your Google Account security page and retry.",
      );
    }

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
    let externalEmail = await fetchGmailProfileEmail(tokens.access_token);
    if (!externalEmail && existing?.externalEmail) {
      externalEmail = existing.externalEmail;
    }

    await prisma.connector.upsert({
      where: {
        userId_provider: {
          userId: uid,
          provider: ConnectorProvider.GMAIL,
        },
      },
      create: {
        userId: uid,
        provider: ConnectorProvider.GMAIL,
        refreshToken,
        accessToken: tokens.access_token,
        accessExpiresAt: expiresAt,
        scopes: tokens.scope ?? GMAIL_CONNECTOR_SCOPES,
        externalEmail,
      },
      update: {
        refreshToken,
        accessToken: tokens.access_token,
        accessExpiresAt: expiresAt,
        scopes: tokens.scope ?? GMAIL_CONNECTOR_SCOPES,
        ...(externalEmail ? { externalEmail } : {}),
      },
    });

    return NextResponse.redirect(`${origin}/settings?connector=gmail_connected`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "oauth_callback_failed";
    return redirectErr(msg);
  }
}
