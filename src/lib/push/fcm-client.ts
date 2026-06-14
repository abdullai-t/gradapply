import { importPKCS8, SignJWT } from "jose";

import {
  firebaseMessagingProjectId,
  getFirebaseServiceAccount,
} from "@/lib/firebase/service-account";

const FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";

type CachedToken = {
  accessToken: string;
  expiresAtMs: number;
};

let cachedAccessToken: CachedToken | null = null;

export function isFcmConfigured(): boolean {
  return Boolean(getFirebaseServiceAccount() && firebaseMessagingProjectId());
}

async function fetchGoogleAccessToken(): Promise<string | null> {
  const serviceAccount = getFirebaseServiceAccount();
  if (!serviceAccount) return null;

  const nowMs = Date.now();
  if (cachedAccessToken && cachedAccessToken.expiresAtMs > nowMs + 60_000) {
    return cachedAccessToken.accessToken;
  }

  const nowSec = Math.floor(nowMs / 1000);
  const privateKey = await importPKCS8(serviceAccount.private_key, "RS256");
  const assertion = await new SignJWT({ scope: FCM_SCOPE })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(serviceAccount.client_email)
    .setSubject(serviceAccount.client_email)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt(nowSec)
    .setExpirationTime(nowSec + 3600)
    .sign(privateKey);

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!res.ok) return null;

  const body = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!body.access_token) return null;

  cachedAccessToken = {
    accessToken: body.access_token,
    expiresAtMs: nowMs + (body.expires_in ?? 3600) * 1000,
  };
  return body.access_token;
}

export type FcmSendPayload = {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
};

export type FcmSendResult =
  | { status: "sent" }
  | { status: "failed"; error: string; staleToken?: boolean };

export function buildFcmMessageBody(payload: FcmSendPayload) {
  const data = payload.data ?? {};
  return {
    message: {
      token: payload.token,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: {
        ...data,
        title: payload.title,
        body: payload.body,
      },
      webpush: {
        fcmOptions: {
          link: data.url,
        },
      },
    },
  };
}

function isStaleTokenError(status: number, body: string): boolean {
  if (status === 404) return true;
  const lower = body.toLowerCase();
  return (
    lower.includes("not_found") ||
    lower.includes("unregistered") ||
    lower.includes("registration token")
  );
}

export async function sendFcmMessage(
  payload: FcmSendPayload,
): Promise<FcmSendResult> {
  const projectId = firebaseMessagingProjectId();
  const accessToken = await fetchGoogleAccessToken();
  if (!projectId || !accessToken) {
    return { status: "failed", error: "fcm_not_configured" };
  }

  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildFcmMessageBody(payload)),
    },
  );

  if (res.ok) return { status: "sent" };

  const text = await res.text().catch(() => "");
  return {
    status: "failed",
    error: text || `fcm_http_${res.status}`,
    staleToken: isStaleTokenError(res.status, text),
  };
}

/** @internal test helper */
export function resetFcmAccessTokenCacheForTests(): void {
  cachedAccessToken = null;
}
