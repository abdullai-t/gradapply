import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Nodemailer from "next-auth/providers/nodemailer";

import { authConfig } from "@/auth.config";
import { credentialsAuthorize } from "@/lib/credentials-authorize";
import { getNodemailerProviderOptions } from "@/lib/mail";
import { prisma } from "@/lib/prisma";

function nodemailerProviders() {
  const options = getNodemailerProviderOptions();
  if (!options) return [];
  return [
    Nodemailer({
      server: options.server,
      from: options.from,
    }),
  ];
}

function credentialsProvider() {
  return Credentials({
    id: "credentials",
    name: "Email and password",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      const email = typeof credentials?.email === "string" ? credentials.email : "";
      const password =
        typeof credentials?.password === "string" ? credentials.password : "";
      return credentialsAuthorize(prisma, { email, password });
    },
  });
}

/**
 * Single Auth.js instance (Node). Includes adapter + all providers.
 * Route handler re-exports `handlers`; server code imports `auth` from `@/auth`.
 *
 * Middleware must NOT import this module — use `getToken` from `next-auth/jwt`.
 */
export const { handlers, auth } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers: [
    credentialsProvider(),
    ...authConfig.providers,
    ...nodemailerProviders(),
  ],
});
