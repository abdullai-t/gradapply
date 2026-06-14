"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  readPushPermissionState,
  requestPushPermissionAndToken,
  subscribeForegroundPushMessages,
  type PushPermissionState,
} from "@/lib/firebase/messaging";

type UsePushNotificationsOptions = {
  enabled: boolean;
  onForegroundMessage?: (payload: {
    title: string;
    body: string;
    url?: string;
  }) => void;
};

export function usePushNotifications({
  enabled,
  onForegroundMessage,
}: UsePushNotificationsOptions) {
  const [permission, setPermission] = useState<PushPermissionState>("default");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registeredToken, setRegisteredToken] = useState<string | null>(null);

  useEffect(() => {
    setPermission(readPushPermissionState());
  }, []);

  useEffect(() => {
    if (!enabled || permission !== "granted") return;
    return subscribeForegroundPushMessages((payload) => {
      onForegroundMessage?.(payload);
    });
  }, [enabled, onForegroundMessage, permission]);

  const registerToken = useCallback(async (token: string) => {
    const res = await fetch("/api/push/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        platform: "web",
      }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      throw new Error(body?.error ?? "Could not save push token.");
    }
    setRegisteredToken(token);
  }, []);

  const enable = useCallback(async (): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      const result = await requestPushPermissionAndToken();
      setPermission(readPushPermissionState());
      if (!result.ok) {
        setError(result.message);
        return false;
      }
      await registerToken(result.token);
      return true;
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Could not enable push.";
      setError(message);
      return false;
    } finally {
      setBusy(false);
    }
  }, [registerToken]);

  const disable = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await fetch("/api/push/unregister", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          registeredToken ? { token: registeredToken } : {},
        ),
      });
      setRegisteredToken(null);
    } finally {
      setBusy(false);
    }
  }, [registeredToken]);

  const statusLabel = useMemo(() => {
    if (permission === "unsupported") return "Not supported in this browser";
    if (permission === "denied") return "Blocked in browser settings";
    if (enabled && permission === "granted") return "Enabled";
    if (permission === "granted") return "Permission granted — turn on below";
    return "Not enabled";
  }, [enabled, permission]);

  return {
    permission,
    busy,
    error,
    statusLabel,
    enable,
    disable,
  };
}
