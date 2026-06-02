export const SESSION_COOKIE_NAME = "__gradapply_session";

/**
 * Max age for the HttpOnly session cookie. Matches Firebase session cookie TTL
 * created in POST /api/auth/session (not the ~1h ID token lifetime).
 */
export const SESSION_COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 5;

/** Firebase Admin `createSessionCookie` expiresIn (ms) — keep in sync with maxAge above. */
export const FIREBASE_SESSION_COOKIE_EXPIRES_MS =
  SESSION_COOKIE_MAX_AGE_SEC * 1000;

export function sessionCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_COOKIE_MAX_AGE_SEC,
  };
}
