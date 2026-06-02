import { getFirebaseAdminAuth } from "./admin";
import {
  verifyFirebaseIdTokenEdge,
  verifyFirebaseSessionCookieEdge,
  type VerifiedFirebaseToken,
} from "./verify-token-edge";

export type { VerifiedFirebaseToken } from "./verify-token-edge";

function payloadFromDecoded(decoded: {
  uid: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  role?: unknown;
  admin?: unknown;
}): VerifiedFirebaseToken {
  return {
    sub: decoded.uid,
    email: decoded.email,
    email_verified: decoded.email_verified,
    name: decoded.name,
    picture: decoded.picture,
    role: typeof decoded.role === "string" ? decoded.role : undefined,
    admin: decoded.admin === true,
  };
}

/** Node verification via Admin SDK (API routes / server components). */
export async function verifyFirebaseIdTokenNode(
  idToken: string,
): Promise<VerifiedFirebaseToken | null> {
  const adminAuth = getFirebaseAdminAuth();
  if (!adminAuth) {
    return verifyFirebaseIdTokenEdge(idToken);
  }

  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    return payloadFromDecoded(decoded);
  } catch {
    return null;
  }
}

/**
 * Verifies a Firebase session cookie (preferred) or legacy ID token stored in the session cookie.
 */
export async function verifyFirebaseSessionCookieNode(
  cookieValue: string,
): Promise<VerifiedFirebaseToken | null> {
  const adminAuth = getFirebaseAdminAuth();
  if (!adminAuth) {
    return verifyFirebaseSessionCookieEdge(cookieValue);
  }

  try {
    const decoded = await adminAuth.verifySessionCookie(cookieValue, true);
    return payloadFromDecoded(decoded);
  } catch {
    return verifyFirebaseIdTokenNode(cookieValue);
  }
}
