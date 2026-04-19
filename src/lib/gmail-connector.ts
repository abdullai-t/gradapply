/**
 * Gmail connector: OAuth (same Google Cloud client as login) + Gmail REST send/profile.
 */

import { ConnectorProvider } from "@prisma/client";

import { appOrigin } from "@/lib/app-origin";
import {
  exchangeGoogleAuthCode,
  getGoogleOAuthClientId,
  refreshGoogleAccessToken,
  type GoogleTokenResponse,
} from "@/lib/google-oauth-tokens";
import { prisma } from "@/lib/prisma";

const GMAIL_SCOPE_SEND =
  "https://www.googleapis.com/auth/gmail.send";
const GMAIL_SCOPE_READ =
  "https://www.googleapis.com/auth/gmail.readonly";

/** Scopes requested when connecting Gmail (send outreach + optional reply checks later). */
export const GMAIL_CONNECTOR_SCOPES = [GMAIL_SCOPE_SEND, GMAIL_SCOPE_READ].join(
  " ",
);

export type TokenResponse = GoogleTokenResponse;

export { appOrigin } from "@/lib/app-origin";

export function gmailConnectorRedirectUri(): string {
  return `${appOrigin()}/api/connectors/gmail/callback`;
}

export function buildGmailAuthorizeUrl(state: string): string {
  const clientId = getGoogleOAuthClientId();
  const redirectUri = gmailConnectorRedirectUri();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GMAIL_CONNECTOR_SCOPES,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string): Promise<GoogleTokenResponse> {
  return exchangeGoogleAuthCode(code, gmailConnectorRedirectUri());
}

export async function fetchGmailProfileEmail(
  accessToken: string,
): Promise<string | null> {
  const res = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/profile",
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  const j = (await res.json()) as { emailAddress?: string };
  if (!res.ok) return null;
  return typeof j.emailAddress === "string" ? j.emailAddress : null;
}

/** Minimal RFC 822 message; UTF-8 safe for ASCII-heavy drafts. */
export function buildPlainTextRfc822(args: {
  from: string;
  to: string;
  subject: string;
  body: string;
}): string {
  const subj = args.subject.replace(/\r?\n/g, " ").trim();
  const lines = [
    `From: ${args.from}`,
    `To: ${args.to}`,
    `Subject: ${subj}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    args.body.replace(/\r\n/g, "\n").replace(/\n/g, "\r\n"),
  ];
  return lines.join("\r\n");
}

export function rfc822ToGmailRaw(rfc822: string): string {
  return Buffer.from(rfc822, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function gmailSendRawMessage(
  accessToken: string,
  rawBase64Url: string,
): Promise<void> {
  const res = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw: rawBase64Url }),
    },
  );
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    const msg = j.error?.message ?? (await res.text()) ?? "send_failed";
    throw new Error(msg);
  }
}

/** Returns a valid Gmail access token, refreshing with the stored refresh token when needed. */
export async function ensureFreshGmailAccess(userId: string): Promise<{
  accessToken: string;
  externalEmail: string | null;
}> {
  const row = await prisma.connector.findUnique({
    where: {
      userId_provider: {
        userId,
        provider: ConnectorProvider.GMAIL,
      },
    },
  });
  if (!row) throw new Error("gmail_not_connected");

  const skewMs = 60_000;
  const stillValid =
    row.accessToken &&
    row.accessExpiresAt &&
    row.accessExpiresAt.getTime() > Date.now() + skewMs;

  if (stillValid) {
    return { accessToken: row.accessToken!, externalEmail: row.externalEmail };
  }

  const refreshed = await refreshGoogleAccessToken(row.refreshToken);
  const expiresAt = new Date(Date.now() + refreshed.expires_in * 1000);
  await prisma.connector.update({
    where: { id: row.id },
    data: {
      accessToken: refreshed.access_token,
      accessExpiresAt: expiresAt,
      ...(typeof refreshed.scope === "string"
        ? { scopes: refreshed.scope }
        : {}),
    },
  });

  return {
    accessToken: refreshed.access_token,
    externalEmail: row.externalEmail,
  };
}
