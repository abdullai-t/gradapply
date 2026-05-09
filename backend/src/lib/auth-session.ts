// @ts-nocheck
import { getToken } from "next-auth/jwt";

function authSecret(): string {
  return process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "";
}

export async function resolveUserId(req: Request): Promise<string | null> {
  const secret = authSecret();
  if (!secret) return null;
  const token = await getToken({ req, secret });
  const sub = token?.sub;
  return typeof sub === "string" ? sub : null;
}

export async function resolveSessionEmail(req: Request): Promise<string | null> {
  const secret = authSecret();
  if (!secret) return null;
  const token = await getToken({ req, secret });
  const email = token?.email;
  return typeof email === "string" && email.trim()
    ? email.trim().toLowerCase()
    : null;
}
