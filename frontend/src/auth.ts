import NextAuth from "next-auth";

import { authConfig } from "./auth.config";

/**
 * Session + `auth()` for middleware, RSC, and API routes.
 *
 * No DB adapter here — middleware runs on Edge and cannot load Mongoose (`@gradapply/db`).
 * JWT validation only needs `AUTH_SECRET` + the callbacks in `auth.config.ts`.
 *
 * Nodemailer, Credentials, OAuth linking to MongoDB, and `PrismaAdapter` live in
 * `app/api/auth/[...nextauth]/route.ts` (Node runtime only).
 */
export const { auth } = NextAuth({
  ...authConfig,
});

/** Login UI: which options exist (includes email if env is set, even though those providers load in Node route only). */
export function getAuthSetupStatus() {
  const hasGoogle = Boolean(
    process.env.GOOGLE_CLIENT_ID?.trim() &&
      process.env.GOOGLE_CLIENT_SECRET?.trim(),
  );
  const hasNodemailerUrl = Boolean(
    process.env.EMAIL_SERVER?.trim() && process.env.EMAIL_FROM?.trim(),
  );
  const hasSmtpBlock = Boolean(
    process.env.SMTP_HOST?.trim() &&
      process.env.SMTP_USER?.trim() &&
      process.env.SMTP_PASSWORD?.trim() &&
      process.env.EMAIL_FROM?.trim(),
  );
  const hasEmail = hasNodemailerUrl || hasSmtpBlock;
  const hasSecret = Boolean(
    (process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "").trim(),
  );

  const googleCount = hasGoogle ? 1 : 0;
  const emailCount = hasEmail ? 1 : 0;
  /** Email/password works whenever AUTH_SECRET is set (handled in Node auth route). */
  const passwordCount = hasSecret ? 1 : 0;

  return {
    hasGoogle,
    hasEmail,
    hasSecret,
    hasPasswordLogin: Boolean(hasSecret),
    providerCount: googleCount + emailCount + passwordCount,
  };
}
