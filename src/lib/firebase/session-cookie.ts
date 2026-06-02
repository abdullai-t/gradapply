export const SESSION_COOKIE_NAME = "__gradapply_session";

/**
 * HttpOnly cookie lifetime. Value is a Firebase ID token refreshed by the client
 * on `onAuthStateChanged` via POST /api/auth/session (not Admin session cookies).
 */
export const SESSION_COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 5;

export function sessionCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_COOKIE_MAX_AGE_SEC,
  };
}
