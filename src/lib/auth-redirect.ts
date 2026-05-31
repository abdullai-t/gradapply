/** Relative in-app paths only (no protocol, no //, no backslashes). */
export function isSafeAuthRedirectPath(path: string): boolean {
  if (!path.startsWith("/")) return false;
  if (path.startsWith("//")) return false;
  if (path.includes("\\")) return false;
  if (path.includes("@")) return false;
  return true;
}

/** Default post-sign-in route when no explicit callback is provided. */
export const AUTH_CONTINUE_PATH = "/auth/continue";
