"use client";

import {
  GoogleAuthProvider,
  isSignInWithEmailLink,
  signInWithEmailAndPassword,
  signInWithEmailLink,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";

import { getFirebaseAuth } from "@/lib/firebase/client";

function publicOrigin(): string {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    process.env.AUTH_URL?.replace(/\/$/, "") ??
    "http://localhost:3000"
  );
}

const EMAIL_FOR_SIGN_IN_KEY = "gradapply.emailForSignIn";

export function storeEmailForSignIn(email: string) {
  window.localStorage.setItem(EMAIL_FOR_SIGN_IN_KEY, email.trim());
}

export function getStoredEmailForSignIn(): string | null {
  return window.localStorage.getItem(EMAIL_FOR_SIGN_IN_KEY);
}

export function clearStoredEmailForSignIn() {
  window.localStorage.removeItem(EMAIL_FOR_SIGN_IN_KEY);
}

export async function syncSessionCookie(
  user: User,
  opts?: { admin?: boolean },
): Promise<void> {
  const idToken = await user.getIdToken();
  const url = new URL("/api/auth/session", window.location.origin);
  if (opts?.admin) url.searchParams.set("admin", "1");
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Explicit Origin helps isTrustedMutationOrigin when Referer is omitted.
      Origin: window.location.origin,
      ...(opts?.admin ? { "x-gradapply-admin-login": "1" } : {}),
    },
    body: JSON.stringify({ idToken }),
    credentials: "same-origin",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const msg =
      typeof data.error === "string"
        ? data.error
        : "Could not establish session";
    throw new Error(msg);
  }
}

export async function signOutClient(): Promise<void> {
  const auth = getFirebaseAuth();
  if (auth) {
    await firebaseSignOut(auth);
  }
  await fetch("/api/auth/session", { method: "DELETE", credentials: "same-origin" });
  clearStoredEmailForSignIn();
}

export async function signInWithGoogle(): Promise<User> {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error("Firebase is not configured");
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  await syncSessionCookie(result.user);
  return result.user;
}

export async function sendMagicLink(email: string): Promise<void> {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error("Firebase is not configured");
  const { sendSignInLinkToEmail } = await import("firebase/auth");
  const origin = publicOrigin();
  const actionCodeSettings = {
    url: `${origin}/auth/email-link`,
    handleCodeInApp: true,
  };
  storeEmailForSignIn(email);
  await sendSignInLinkToEmail(auth, email.trim(), actionCodeSettings);
}

export async function completeMagicLinkSignIn(
  email: string,
  linkUrl?: string,
): Promise<User> {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error("Firebase is not configured");
  const href = linkUrl ?? window.location.href;
  if (!isSignInWithEmailLink(auth, href)) {
    throw new Error("Invalid sign-in link");
  }
  const result = await signInWithEmailLink(auth, email.trim(), href);
  clearStoredEmailForSignIn();
  await syncSessionCookie(result.user);
  return result.user;
}

export async function signInAdminWithPassword(
  email: string,
  password: string,
): Promise<User> {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error("Firebase is not configured");
  const result = await signInWithEmailAndPassword(auth, email.trim(), password);
  await syncSessionCookie(result.user, { admin: true });
  return result.user;
}
