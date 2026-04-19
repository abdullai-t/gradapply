import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

/** Shared secret — used by auth.ts (Edge-safe) and route handlers (Node). */
export const authSecret =
  process.env.AUTH_SECRET ??
  process.env.NEXTAUTH_SECRET ??
  "";

function googleProviders() {
  if (
    !process.env.GOOGLE_CLIENT_ID?.trim() ||
    !process.env.GOOGLE_CLIENT_SECRET?.trim()
  ) {
    return [];
  }
  return [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID.trim(),
      clientSecret: process.env.GOOGLE_CLIENT_SECRET.trim(),
      allowDangerousEmailAccountLinking: true,
    }),
  ];
}

/**
 * Edge-compatible auth options: no Nodemailer / Node-only imports.
 * Middleware and `auth()` must import only this + Prisma adapter from auth.ts.
 */
export const authConfig = {
  secret: authSecret || undefined,
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
  trustHost: true,
  debug: process.env.NODE_ENV === "development",
  providers: googleProviders(),
} satisfies NextAuthConfig;
