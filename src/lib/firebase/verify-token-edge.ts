import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

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

/** Edge / Workers-safe Firebase JWT verification (ID token or session cookie JWT). */
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

/** Session cookie value is a Firebase JWT; verify with JWKS when Admin SDK is unavailable. */
export async function verifyFirebaseSessionCookieEdge(
  cookieValue: string,
): Promise<VerifiedFirebaseToken | null> {
  return verifyFirebaseIdTokenEdge(cookieValue);
}
