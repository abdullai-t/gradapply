import { createHash, randomBytes } from "node:crypto";

const TOKEN_BYTES = 32;

function pepper(): string {
  const explicit = process.env.COLLAB_TOKEN_PEPPER?.trim();
  if (explicit) return explicit;
  const authSecret = process.env.AUTH_SECRET?.trim();
  if (authSecret) return authSecret;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "COLLAB_TOKEN_PEPPER or AUTH_SECRET is required in production",
    );
  }
  return "dev-collab-pepper";
}

export function generateCollabGuestToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

export function hashCollabGuestToken(token: string): string {
  return createHash("sha256")
    .update(`${pepper()}:${token}`)
    .digest("hex");
}

export function collabGuestTokenFromRequest(req: Request): string | null {
  const header = req.headers.get("x-collab-guest-token")?.trim();
  if (header) return header;
  const cookie = req.headers.get("cookie");
  if (!cookie) return null;
  const match = cookie.match(/(?:^|;\s*)collab_guest=([^;]+)/);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}
