const DEFAULT_MAX_AGE_SEC = 60 * 60 * 24 * 7;
const MAX_COOKIE_AGE_SEC = 60 * 60 * 24 * 30;

export function collabGuestCookieMaxAgeSec(expiresAt: Date | null): number {
  if (!expiresAt) return DEFAULT_MAX_AGE_SEC;
  const sec = Math.floor((expiresAt.getTime() - Date.now()) / 1000);
  if (sec <= 0) return 60;
  return Math.min(sec, MAX_COOKIE_AGE_SEC);
}

/** HttpOnly guest session cookie for collaboration links. */
export function collabGuestSetCookieHeader(
  token: string,
  expiresAt: Date | null,
): string {
  const maxAge = collabGuestCookieMaxAgeSec(expiresAt);
  const secure =
    process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `collab_guest=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}
