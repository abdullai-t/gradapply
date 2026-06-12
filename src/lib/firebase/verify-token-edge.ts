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

/** E2E-only fixture tokens: `e2e:<uid>:<email>` when ALLOW_E2E_FIXTURES=1. */
function tryVerifyE2eFixtureToken(
  idToken: string,
): VerifiedFirebaseToken | null {
  if (process.env.ALLOW_E2E_FIXTURES !== "1") return null;
  const prefix = "e2e:";
  if (!idToken.startsWith(prefix)) return null;
  const rest = idToken.slice(prefix.length);
  const [sub, email = "e2e@test.local"] = rest.split(":");
  if (!sub?.trim()) return null;
  return {
    sub: sub.trim(),
    email: email.trim(),
    email_verified: true,
  };
}

/** Edge / Workers-safe Firebase JWT verification (ID token or session cookie JWT). */
export async function verifyFirebaseIdTokenEdge(
  idToken: string,
): Promise<VerifiedFirebaseToken | null> {
  const fixture = tryVerifyE2eFixtureToken(idToken);
  if (fixture) return fixture;

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
