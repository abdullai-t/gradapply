/**
 * Shared Google OAuth token exchange (same client as Gmail / Drive connectors).
 */

function requireGoogleCreds(): { clientId: string; clientSecret: string } {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error(
      "Google connectors require GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
    );
  }
  return { clientId, clientSecret };
}

/** Public client id for building authorize URLs (throws if unset). */
export function getGoogleOAuthClientId(): string {
  return requireGoogleCreds().clientId;
}

async function postForm(url: string, body: Record<string, string>): Promise<Response> {
  const form = new URLSearchParams(body);
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
}

export type GoogleTokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
};

export async function exchangeGoogleAuthCode(
  code: string,
  redirectUri: string,
): Promise<GoogleTokenResponse> {
  const { clientId, clientSecret } = requireGoogleCreds();
  const res = await postForm("https://oauth2.googleapis.com/token", {
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
  const j = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const msg =
      typeof j.error_description === "string"
        ? j.error_description
        : typeof j.error === "string"
          ? j.error
          : "token_exchange_failed";
    throw new Error(msg);
  }
  return j as GoogleTokenResponse;
}

export async function refreshGoogleAccessToken(
  refreshToken: string,
): Promise<GoogleTokenResponse> {
  const { clientId, clientSecret } = requireGoogleCreds();
  const res = await postForm("https://oauth2.googleapis.com/token", {
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
  });
  const j = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(
      typeof j.error === "string" ? j.error : "refresh_token_failed",
    );
  }
  return j as GoogleTokenResponse;
}

/** Account email from OAuth userinfo (works with userinfo.email scope). */
export async function fetchGoogleUserinfoEmail(
  accessToken: string,
): Promise<string | null> {
  const res = await fetch(
    "https://www.googleapis.com/oauth2/v2/userinfo",
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  const j = (await res.json()) as { email?: string };
  if (!res.ok) return null;
  return typeof j.email === "string" ? j.email : null;
}
