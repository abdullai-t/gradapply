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
    error: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      try {
        if (new URL(url).origin === new URL(baseUrl).origin) return url;
      } catch {
        // ignore malformed callback URLs
      }
      return `${baseUrl}/dashboard`;
    },
    jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        if ("role" in user) {
          const role =
            typeof user.role === "string" ? user.role.toUpperCase() : null;
          if (role === "USER" || role === "ADMIN" || role === "SUPERADMIN") {
            token.role = role;
          } else if (!token.role) {
            token.role = "USER";
          }
        }
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        if (token.role) {
          session.user.role = token.role;
        }
      }
      return session;
    },
  },
  trustHost: true,
  debug: process.env.NODE_ENV === "development",
  providers: googleProviders(),
} satisfies NextAuthConfig;
