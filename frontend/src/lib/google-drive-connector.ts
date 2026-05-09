// @ts-nocheck
/**
 * Google Drive connector: OAuth + token refresh for future Drive imports.
 */

import { ConnectorProvider } from "@/types/enums";

import { appOrigin } from "@/lib/app-origin";
import {
  exchangeGoogleAuthCode,
  fetchGoogleUserinfoEmail,
  getGoogleOAuthClientId,
  refreshGoogleAccessToken,
  type GoogleTokenResponse,
} from "@/lib/google-oauth-tokens";
import { prisma } from "@/lib/prisma";

/** List and read files & metadata (import CV/PDF drafts later). */
const DRIVE_SCOPE_READONLY = "https://www.googleapis.com/auth/drive.readonly";
const USERINFO_EMAIL = "https://www.googleapis.com/auth/userinfo.email";

export const GOOGLE_DRIVE_CONNECTOR_SCOPES = [
  DRIVE_SCOPE_READONLY,
  USERINFO_EMAIL,
].join(" ");

export function googleDriveConnectorRedirectUri(): string {
  return `${appOrigin()}/api/connectors/google-drive/callback`;
}

export function buildGoogleDriveAuthorizeUrl(state: string): string {
  const clientId = getGoogleOAuthClientId();
  const redirectUri = googleDriveConnectorRedirectUri();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_DRIVE_CONNECTOR_SCOPES,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeDriveCodeForTokens(
  code: string,
): Promise<GoogleTokenResponse> {
  return exchangeGoogleAuthCode(code, googleDriveConnectorRedirectUri());
}

/** Valid access token for Drive API calls (refreshes when stale). */
export async function ensureFreshDriveAccess(userId: string): Promise<{
  accessToken: string;
  externalEmail: string | null;
}> {
  const row = await prisma.connector.findUnique({
    where: {
      userId_provider: {
        userId,
        provider: ConnectorProvider.GOOGLE_DRIVE,
      },
    },
  });
  if (!row) throw new Error("google_drive_not_connected");

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

export async function resolveDriveAccountEmail(
  accessToken: string,
  fallback: string | null,
): Promise<string | null> {
  const fromApi = await fetchGoogleUserinfoEmail(accessToken);
  return fromApi ?? fallback ?? null;
}
