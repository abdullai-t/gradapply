import { isMailConfigured } from "@/lib/mail";

export { auth, handlers } from "@/lib/auth-server";

/**
 * Login UI helpers. Provider wiring lives in `@/lib/auth-server` (Node only).
 * Middleware uses JWT via `getToken` — do not call `auth()` there.
 */
export function getAuthSetupStatus() {
  const hasGoogle = Boolean(
    process.env.GOOGLE_CLIENT_ID?.trim() &&
      process.env.GOOGLE_CLIENT_SECRET?.trim(),
  );
  const hasEmail = isMailConfigured();
  const hasSecret = Boolean(
    (process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "").trim(),
  );

  const googleCount = hasGoogle ? 1 : 0;
  const emailCount = hasEmail ? 1 : 0;
  const passwordCount = hasSecret ? 1 : 0;

  return {
    hasGoogle,
    hasEmail,
    hasSecret,
    hasPasswordLogin: Boolean(hasSecret),
    providerCount: googleCount + emailCount + passwordCount,
  };
}
