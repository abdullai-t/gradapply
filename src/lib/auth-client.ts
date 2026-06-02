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

const SESSION_SYNC_STORAGE_KEY = "gradapply.sessionSyncedAt";

/** Sync verified Firebase ID token into the HttpOnly session cookie (no DB). */
export async function syncSessionCookie(
  user: User,
  opts?: { force?: boolean },
): Promise<void> {
  const uid = user.uid;
  const now = Date.now();
  if (!opts?.force && typeof window !== "undefined") {
    try {
      const raw = sessionStorage.getItem(SESSION_SYNC_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { uid?: string; at?: number };
        if (parsed.uid === uid && typeof parsed.at === "number" && now - parsed.at < 55 * 60 * 1000) {
          return;
        }
      }
    } catch {
      /* ignore */
    }
  }

  const idToken = await user.getIdToken();
  const res = await fetch("/api/auth/session", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: window.location.origin,
    },
    body: JSON.stringify({ idToken }),
    credentials: "same-origin",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const msg =
      typeof data.error === "string"
        ? data.error
        : "Could not sync Firebase session";
    throw new Error(msg);
  }

  if (typeof window !== "undefined") {
    sessionStorage.setItem(
      SESSION_SYNC_STORAGE_KEY,
      JSON.stringify({ uid, at: now }),
    );
  }
}

/** Load app user row in Postgres after Firebase sign-in. */
export async function fetchAppUserProfile(opts?: {
  admin?: boolean;
}): Promise<{
  id: string;
  email: string | null;
  name: string | null;
  image: string | null;
  role: string;
}> {
  const url = new URL("/api/auth/me", window.location.origin);
  if (opts?.admin) url.searchParams.set("admin", "1");
  const res = await fetch(url.toString(), {
    credentials: "same-origin",
    headers: opts?.admin ? { "x-gradapply-admin-login": "1" } : {},
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      typeof data.error === "string"
        ? data.error
        : "Could not load your account";
    throw new Error(msg);
  }
  if (!data?.user?.id) throw new Error("Could not load your account");
  return data.user;
}

export async function signOutClient(): Promise<void> {
  const auth = getFirebaseAuth();
  if (auth) {
    await firebaseSignOut(auth);
  }
  await fetch("/api/auth/session", { method: "DELETE", credentials: "same-origin" });
  clearStoredEmailForSignIn();
  if (typeof window !== "undefined") {
    sessionStorage.removeItem(SESSION_SYNC_STORAGE_KEY);
  }
}

export async function signInWithGoogle(): Promise<User> {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error("Firebase is not configured");
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  await syncSessionCookie(result.user, { force: true });
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
  await syncSessionCookie(result.user, { force: true });
  return result.user;
}

export async function signInAdminWithPassword(
  email: string,
  password: string,
): Promise<User> {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error("Firebase is not configured");
  const result = await signInWithEmailAndPassword(auth, email.trim(), password);
  await syncSessionCookie(result.user, { force: true });
  await fetchAppUserProfile({ admin: true });
  return result.user;
}
