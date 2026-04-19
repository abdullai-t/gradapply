import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";

import { authConfig } from "./auth.config";
import { prisma } from "@/lib/prisma";

/**
 * Session + `auth()` for middleware, RSC, and API routes.
 * Intentionally excludes Nodemailer and Credentials so the Edge middleware bundle stays compatible.
 * Email magic link + credentials are registered only in `app/api/auth/[...nextauth]/route.ts`.
 * Sessions use JWT so email/password works alongside OAuth + Prisma.
 */
export const { auth } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
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
