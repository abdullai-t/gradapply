import type { App } from "firebase-admin/app";
import type { Auth } from "firebase-admin/auth";

/** Cloudflare Workers build: Admin SDK is not bundled (size + jwks-rsa/jose resolution). */
export function getFirebaseAdminApp(): App | null {
  return null;
}

export function getFirebaseAdminAuth(): Auth | null {
  return null;
}
