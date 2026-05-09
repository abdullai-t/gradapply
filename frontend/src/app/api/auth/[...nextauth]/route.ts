import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Nodemailer from "next-auth/providers/nodemailer";

import { authConfig } from "@/auth.config";
import { credentialsAuthorize } from "@/lib/credentials-authorize";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * Full provider list (Google + optional Nodemailer). Keep Nodemailer here only —
 * this route runs in the Node.js runtime, not Edge middleware.
 */
function nodemailerProviders() {
  const list = [];
  if (
    process.env.EMAIL_SERVER?.trim() &&
    process.env.EMAIL_FROM?.trim()
  ) {
    list.push(
      Nodemailer({
        server: process.env.EMAIL_SERVER.trim(),
        from: process.env.EMAIL_FROM.trim(),
      }),
    );
  } else if (
    process.env.SMTP_HOST?.trim() &&
    process.env.SMTP_USER?.trim() &&
    process.env.SMTP_PASSWORD?.trim() &&
    process.env.EMAIL_FROM?.trim()
  ) {
    list.push(
      Nodemailer({
        server: {
          host: process.env.SMTP_HOST.trim(),
          port: Number(process.env.SMTP_PORT ?? "587"),
          auth: {
            user: process.env.SMTP_USER.trim(),
            pass: process.env.SMTP_PASSWORD.trim(),
          },
        },
        from: process.env.EMAIL_FROM.trim(),
      }),
    );
  }
  return list;
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

const { handlers } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers: [
    credentialsProvider(),
    ...authConfig.providers,
    ...nodemailerProviders(),
  ],
});

export const { GET, POST } = handlers;
