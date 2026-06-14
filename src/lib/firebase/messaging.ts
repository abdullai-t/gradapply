"use client";

import {
  getMessaging,
  getToken,
  isSupported,
  onMessage,
  type Messaging,
} from "firebase/messaging";

import {
  getFirebaseVapidKey,
  isFirebaseMessagingConfigured,
} from "./config";
import { getFirebaseApp } from "./client";

let messagingInstance: Messaging | null | undefined;

export type PushEnableFailureReason =
  | "unsupported"
  | "permission_denied"
  | "missing_config"
  | "service_worker"
  | "messaging_init"
  | "token";

export type PushEnableResult =
  | { ok: true; token: string }
  | { ok: false; reason: PushEnableFailureReason; message: string };

export function isBrowserPushSupported(): boolean {
  if (typeof window === "undefined") return false;
  if (!window.isSecureContext) return false;
  if (!("Notification" in window) || !("serviceWorker" in navigator)) {
    return false;
  }
  return isFirebaseMessagingConfigured();
}

export async function ensureBrowserPushSupported(): Promise<boolean> {
  if (!isBrowserPushSupported()) return false;
  try {
    return await isSupported();
  } catch {
    return false;
  }
}

function formatFirebaseError(err: unknown): string {
  const code =
    err && typeof err === "object" && "code" in err
      ? String((err as { code: string }).code)
      : "";
  const message = err instanceof Error ? err.message : String(err);

  if (code === "messaging/permission-blocked") {
    return "Notifications are blocked for this site in your browser.";
  }
  if (
    code === "messaging/token-subscribe-failed" ||
    message.toLowerCase().includes("vapid")
  ) {
    return "VAPID key mismatch. Set NEXT_PUBLIC_FIREBASE_VAPID_KEY to the Web Push key pair from Firebase Console → Project settings → Cloud Messaging, then restart dev.";
  }
  if (
    code === "messaging/failed-service-worker-registration" ||
    message.toLowerCase().includes("service worker")
  ) {
    return "Service worker failed to register. Run pnpm run generate:fcm-sw, restart dev, and hard-refresh this page.";
  }
  if (code === "messaging/unsupported-browser") {
    return "This browser does not support Firebase web push. Try Chrome or Edge on desktop.";
  }
  if (message) return message;
  return "Unknown Firebase messaging error.";
}

function initMessaging(): Messaging | null {
  const app = getFirebaseApp();
  if (!app) return null;
  if (messagingInstance === undefined) {
    try {
      messagingInstance = getMessaging(app);
    } catch (err) {
      messagingInstance = null;
      if (process.env.NODE_ENV === "development") {
        console.warn("[push] getMessaging failed:", err);
      }
    }
  }
  return messagingInstance;
}

async function registerMessagingServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    const registration = await navigator.serviceWorker.register(
      "/firebase-messaging-sw.js",
    );
    await navigator.serviceWorker.ready;
    return registration;
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[push] service worker registration failed:", err);
    }
    return null;
  }
}

export type PushPermissionState = "unsupported" | "default" | "granted" | "denied";

export function readPushPermissionState(): PushPermissionState {
  if (!isBrowserPushSupported()) return "unsupported";
  if (typeof Notification === "undefined") return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  return "default";
}

/** Request permission and return an FCM registration token. */
export async function requestPushPermissionAndToken(): Promise<PushEnableResult> {
  if (!window.isSecureContext) {
    return {
      ok: false,
      reason: "unsupported",
      message: "Push requires HTTPS (or localhost). Open the app over a secure URL.",
    };
  }

  const supported = await ensureBrowserPushSupported();
  if (!supported) {
    return {
      ok: false,
      reason: "unsupported",
      message:
        "Push is not supported here. Use Chrome or Edge, set NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID and NEXT_PUBLIC_FIREBASE_VAPID_KEY, then restart dev.",
    };
  }

  const permission =
    Notification.permission === "granted"
      ? "granted"
      : await Notification.requestPermission();

  if (permission !== "granted") {
    return {
      ok: false,
      reason: "permission_denied",
      message:
        permission === "denied"
          ? "Browser notifications are blocked. Allow notifications for this site in browser settings."
          : "Notification permission was not granted.",
    };
  }

  const vapidKey = getFirebaseVapidKey();
  if (!vapidKey) {
    return {
      ok: false,
      reason: "missing_config",
      message:
        "Missing NEXT_PUBLIC_FIREBASE_VAPID_KEY. Add it to .env and restart dev.",
    };
  }

  const registration = await registerMessagingServiceWorker();
  if (!registration) {
    return {
      ok: false,
      reason: "service_worker",
      message:
        "Could not register the push service worker. Run pnpm run generate:fcm-sw and hard-refresh.",
    };
  }

  const msg = initMessaging();
  if (!msg) {
    return {
      ok: false,
      reason: "messaging_init",
      message:
        "Firebase messaging failed to initialize. Check NEXT_PUBLIC_FIREBASE_* client keys and restart dev.",
    };
  }

  try {
    const token = await getToken(msg, {
      vapidKey,
      serviceWorkerRegistration: registration,
    });
    if (!token) {
      return {
        ok: false,
        reason: "token",
        message: "Firebase returned an empty push token.",
      };
    }
    return { ok: true, token };
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[push] getToken failed:", err);
    }
    return {
      ok: false,
      reason: "token",
      message: formatFirebaseError(err),
    };
  }
}

export function subscribeForegroundPushMessages(
  handler: (payload: {
    title: string;
    body: string;
    url?: string;
  }) => void,
): () => void {
  const msg = initMessaging();
  if (!msg) return () => {};

  return onMessage(msg, (payload) => {
    const title =
      payload.notification?.title ||
      payload.data?.title ||
      "GradApply reminder";
    const body =
      payload.notification?.body ||
      payload.data?.body ||
      "You have an application update.";
    const url = payload.data?.url;
    handler({ title, body, url });
  });
}
