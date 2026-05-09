// @ts-nocheck
/**
 * Shared Google OAuth token exchange (same client as Gmail / Drive connectors).
 *
 * The OAuth *client* ID/secret identify GradApply to Google (server env).
 * Each user’s *refresh token* is stored per-user in `Connector` — not shared.
 */
/** True when the deployment can run Google OAuth (admin-configured env). */
export function isGoogleOAuthConfigured() {
    const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
    return Boolean(clientId && clientSecret);
}
function requireGoogleCreds() {
    const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
    if (!clientId || !clientSecret) {
        throw new Error("Google OAuth is not configured on this server (missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).");
    }
    return { clientId, clientSecret };
}
/** Public client id for building authorize URLs (throws if unset). */
export function getGoogleOAuthClientId() {
    return requireGoogleCreds().clientId;
}
async function postForm(url, body) {
    const form = new URLSearchParams(body);
    return fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form.toString(),
    });
}
export async function exchangeGoogleAuthCode(code, redirectUri) {
    const { clientId, clientSecret } = requireGoogleCreds();
    const res = await postForm("https://oauth2.googleapis.com/token", {
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
    });
    const j = (await res.json());
    if (!res.ok) {
        const msg = typeof j.error_description === "string"
            ? j.error_description
            : typeof j.error === "string"
                ? j.error
                : "token_exchange_failed";
        throw new Error(msg);
    }
    return j;
}
export async function refreshGoogleAccessToken(refreshToken) {
    const { clientId, clientSecret } = requireGoogleCreds();
    const res = await postForm("https://oauth2.googleapis.com/token", {
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
    });
    const j = (await res.json());
    if (!res.ok) {
        throw new Error(typeof j.error === "string" ? j.error : "refresh_token_failed");
    }
    return j;
}
/** Account email from OAuth userinfo (works with userinfo.email scope). */
export async function fetchGoogleUserinfoEmail(accessToken) {
    const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    const j = (await res.json());
    if (!res.ok)
        return null;
    return typeof j.email === "string" ? j.email : null;
}
