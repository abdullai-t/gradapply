// @ts-nocheck
import crypto from "crypto";

const PREFIX = "ga_oauth_v1";

function secretKey(): string {
  const s =
    process.env.AUTH_SECRET ??
    process.env.NEXTAUTH_SECRET ??
    "";
  return s.trim();
}

/** Signed opaque token for OAuth `state` (CSRF + user binding). */
export function signOAuthState(payload: Record<string, unknown>): string {
  const secret = secretKey();
  if (!secret) throw new Error("AUTH_SECRET is required for OAuth connectors");
  const body = Buffer.from(JSON.stringify({ v: 1, ...payload }), "utf8").toString(
    "base64url",
  );
  const sig = crypto.createHmac("sha256", secret).update(body).digest("hex");
  return `${PREFIX}.${body}.${sig}`;
}

export function verifyOAuthState(token: string): Record<string, unknown> | null {
  const secret = secretKey();
  if (!secret) return null;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== PREFIX) return null;
  const [, body, sig] = parts;
  if (!body || !sig) return null;
  const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
  try {
    const sigBuf = Buffer.from(sig, "hex");
    const expBuf = Buffer.from(expected, "hex");
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf))
      return null;
  } catch {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Record<
      string,
      unknown
    >;
    const exp = typeof parsed.exp === "number" ? parsed.exp : null;
    if (exp != null && Date.now() > exp) return null;
    return parsed;
  } catch {
    return null;
  }
}
