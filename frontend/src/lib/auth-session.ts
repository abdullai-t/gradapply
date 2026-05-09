import { getToken } from "next-auth/jwt";

function authSecret(): string {
  return process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "";
}

/**
 * Resolve the signed-in user id from a Web Request (JWT session cookie).
 * Works for Next.js Route Handlers and for the Express API server forwarding cookies.
 */
export async function resolveUserId(req: Request): Promise<string | null> {
  const secret = authSecret();
  if (!secret) return null;
  const token = await getToken({ req, secret });
  const sub = token?.sub;
  return typeof sub === "string" ? sub : null;
}

/**
 * Email from the JWT (fallback when DB email is missing), normalized or null.
 */
export async function resolveSessionEmail(req: Request): Promise<string | null> {
  const secret = authSecret();
  if (!secret) return null;
  const token = await getToken({ req, secret });
  const email = token?.email;
  return typeof email === "string" && email.trim() ? email.trim().toLowerCase() : null;
}
