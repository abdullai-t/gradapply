import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

import { getFirebaseAdminAuth } from "./admin";
import { firebaseProjectId } from "./config";

const FIREBASE_JWKS = createRemoteJWKSet(
  new URL(
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
  ),
);

export type VerifiedFirebaseToken = JWTPayload & {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  role?: string;
  admin?: boolean;
};

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

/** Edge-safe Firebase ID token verification (middleware). */
export async function verifyFirebaseIdTokenEdge(
  idToken: string,
): Promise<VerifiedFirebaseToken | null> {
  const projectId = firebaseProjectId();
  if (!projectId) return null;

  try {
    const { payload } = await jwtVerify(idToken, FIREBASE_JWKS, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
    });
    if (!payload.sub) return null;
    return payload as VerifiedFirebaseToken;
  } catch {
    return null;
  }
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
    return verifyFirebaseIdTokenEdge(cookieValue);
  }

  try {
    const decoded = await adminAuth.verifySessionCookie(cookieValue, true);
    return payloadFromDecoded(decoded);
  } catch {
    return verifyFirebaseIdTokenNode(cookieValue);
  }
}
