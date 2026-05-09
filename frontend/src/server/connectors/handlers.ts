// @ts-nocheck
import { NextResponse, type NextRequest } from "next/server";
import { ConnectorProvider } from "@/types/enums";

import { resolveUserId } from "@/lib/auth-session";
import { appOrigin } from "@/lib/app-origin";
import {
  buildGmailAuthorizeUrl,
  exchangeCodeForTokens,
  fetchGmailProfileEmail,
  GMAIL_CONNECTOR_SCOPES,
} from "@/lib/gmail-connector";
import {
  buildGoogleDriveAuthorizeUrl,
  exchangeDriveCodeForTokens,
  GOOGLE_DRIVE_CONNECTOR_SCOPES,
  resolveDriveAccountEmail,
} from "@/lib/google-drive-connector";
import { isGoogleOAuthConfigured } from "@/lib/google-oauth-tokens";
import { signOAuthState, verifyOAuthState } from "@/lib/oauth-state";
import { requireNonFreeForFeature } from "@/lib/plan-gates";
import { prisma } from "@/lib/prisma";
import { isTrustedMutationOrigin } from "@/lib/request-origin";

import { forbidden, ok } from "../_responses";
import { withPlanGate } from "../_with-plan-gate";

/** GET /api/connectors — list user's linked connectors. */
export const list = withPlanGate("connectors", async (_req, { userId }) => {
  const [gmail, drive] = await Promise.all([
    prisma.connector.findUnique({
      where: {
        userId_provider: { userId, provider: ConnectorProvider.GMAIL },
      },
      select: { externalEmail: true, updatedAt: true },
    }),
    prisma.connector.findUnique({
      where: {
        userId_provider: { userId, provider: ConnectorProvider.GOOGLE_DRIVE },
      },
      select: { externalEmail: true, updatedAt: true },
    }),
  ]);

  return ok({
    /** App-wide Google OAuth client is configured (env). Each user still has their own tokens in `Connector`. */
    googleOAuthConfigured: isGoogleOAuthConfigured(),
    connectors: [
      {
        provider: "gmail" as const,
        connected: Boolean(gmail),
        email: gmail?.externalEmail ?? null,
        updatedAt: gmail?.updatedAt?.toISOString() ?? null,
      },
      {
        provider: "google_drive" as const,
        connected: Boolean(drive),
        email: drive?.externalEmail ?? null,
        updatedAt: drive?.updatedAt?.toISOString() ?? null,
      },
    ],
  });
});

/** DELETE /api/connectors/gmail — revoke Gmail connector. */
export const deleteGmail = withPlanGate("connectors", async (req, { userId }) => {
  if (!isTrustedMutationOrigin(req)) return forbidden("Untrusted origin");

  await prisma.connector.deleteMany({
    where: { userId, provider: ConnectorProvider.GMAIL },
  });

  return ok({ ok: true });
});

/** DELETE /api/connectors/google-drive — revoke Drive connector. */
export const deleteGoogleDrive = withPlanGate(
  "connectors",
  async (req, { userId }) => {
    if (!isTrustedMutationOrigin(req)) return forbidden("Untrusted origin");

    await prisma.connector.deleteMany({
      where: { userId, provider: ConnectorProvider.GOOGLE_DRIVE },
    });

    return ok({ ok: true });
  },
);

/**
 * GET /api/connectors/gmail/start — redirects to Google OAuth consent.
 *
 * Cannot use `withPlanGate` directly because the original UX redirects
 * unauthenticated callers to `/login?callbackUrl=/settings` (rather than
 * returning a JSON 401), and redirects plan-locked or misconfigured
 * callers to `/settings?connector_error=...`.
 */
export async function startGmail(req: NextRequest): Promise<Response> {
  const userId = await resolveUserId(req);
  if (!userId) {
    const login = new URL("/login", req.url);
    login.searchParams.set("callbackUrl", "/settings");
    return NextResponse.redirect(login);
  }

  const locked = await requireNonFreeForFeature(userId, "connectors");
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
      uid: userId,
      exp: Date.now() + 10 * 60 * 1000,
    });
    return NextResponse.redirect(buildGmailAuthorizeUrl(state));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "oauth_setup_failed";
    return NextResponse.redirect(
      `${appOrigin()}/settings?connector_error=${encodeURIComponent(msg)}`,
    );
  }
}

/** GET /api/connectors/google-drive/start — same shape as `startGmail`. */
export async function startGoogleDrive(req: NextRequest): Promise<Response> {
  const userId = await resolveUserId(req);
  if (!userId) {
    const login = new URL("/login", req.url);
    login.searchParams.set("callbackUrl", "/settings");
    return NextResponse.redirect(login);
  }

  const locked = await requireNonFreeForFeature(userId, "connectors");
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
      uid: userId,
      exp: Date.now() + 10 * 60 * 1000,
    });
    return NextResponse.redirect(buildGoogleDriveAuthorizeUrl(state));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "oauth_setup_failed";
    return NextResponse.redirect(
      `${appOrigin()}/settings?connector_error=${encodeURIComponent(msg)}`,
    );
  }
}

/**
 * GET /api/connectors/gmail/callback — exchange OAuth code for tokens.
 *
 * Like `startGmail`, this can't use the standard wrappers because the
 * pre-migration UX redirects to `/settings?connector_error=...` on every
 * failure mode (unauth, missing params, invalid state, exchange failure)
 * rather than returning JSON. We perform auth + plan-gate inline.
 */
export async function gmailCallback(req: Request): Promise<Response> {
  const userId = await resolveUserId(req);
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
  if (!userId) return redirectErr("not_signed_in");

  const locked = await requireNonFreeForFeature(userId, "connectors");
  if (locked) return locked;

  if (!code?.trim() || !state?.trim()) return redirectErr("missing_oauth_params");

  const payload = verifyOAuthState(state);
  const uid = typeof payload?.uid === "string" ? payload.uid : null;
  if (!uid || uid !== userId) return redirectErr("invalid_state");

  try {
    const tokens = await exchangeCodeForTokens(code);

    const existing = await prisma.connector.findUnique({
      where: {
        userId_provider: { userId: uid, provider: ConnectorProvider.GMAIL },
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
        userId_provider: { userId: uid, provider: ConnectorProvider.GMAIL },
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

/** GET /api/connectors/google-drive/callback — same shape as `gmailCallback`. */
export async function googleDriveCallback(req: Request): Promise<Response> {
  const userId = await resolveUserId(req);
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
  if (!userId) return redirectErr("not_signed_in");

  const locked = await requireNonFreeForFeature(userId, "connectors");
  if (locked) return locked;

  if (!code?.trim() || !state?.trim()) return redirectErr("missing_oauth_params");

  const payload = verifyOAuthState(state);
  const uid = typeof payload?.uid === "string" ? payload.uid : null;
  if (!uid || uid !== userId) return redirectErr("invalid_state");

  try {
    const tokens = await exchangeDriveCodeForTokens(code);

    const existing = await prisma.connector.findUnique({
      where: {
        userId_provider: {
          userId: uid,
          provider: ConnectorProvider.GOOGLE_DRIVE,
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
    const externalEmail = await resolveDriveAccountEmail(
      tokens.access_token,
      existing?.externalEmail ?? null,
    );

    await prisma.connector.upsert({
      where: {
        userId_provider: {
          userId: uid,
          provider: ConnectorProvider.GOOGLE_DRIVE,
        },
      },
      create: {
        userId: uid,
        provider: ConnectorProvider.GOOGLE_DRIVE,
        refreshToken,
        accessToken: tokens.access_token,
        accessExpiresAt: expiresAt,
        scopes: tokens.scope ?? GOOGLE_DRIVE_CONNECTOR_SCOPES,
        externalEmail,
      },
      update: {
        refreshToken,
        accessToken: tokens.access_token,
        accessExpiresAt: expiresAt,
        scopes: tokens.scope ?? GOOGLE_DRIVE_CONNECTOR_SCOPES,
        ...(externalEmail ? { externalEmail } : {}),
      },
    });

    return NextResponse.redirect(
      `${origin}/settings?connector=google_drive_connected`,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "oauth_callback_failed";
    return redirectErr(msg);
  }
}
