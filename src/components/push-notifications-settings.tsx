"use client";

import { useCallback, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { cn } from "@/lib/utils";

type Props = {
  enabled: boolean;
  onEnabledChange: (next: boolean) => void;
  onSaveProfile: () => Promise<void>;
  saving: boolean;
};

export function PushNotificationsSettings({
  enabled,
  onEnabledChange,
  onSaveProfile,
  saving,
}: Props) {
  const [banner, setBanner] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const push = usePushNotifications({
    enabled,
    onForegroundMessage: ({ title, body }) => {
      setBanner(`${title}: ${body}`);
      window.setTimeout(() => setBanner(null), 8000);
    },
  });

  const togglePush = useCallback(
    async (next: boolean) => {
      if (next) {
        const ok = await push.enable();
        if (!ok) return;
        onEnabledChange(true);
        await onSaveProfile();
      } else {
        await push.disable();
        onEnabledChange(false);
        await onSaveProfile();
      }
    },
    [onEnabledChange, onSaveProfile, push],
  );

  const needsPermission = push.permission === "default" && !enabled;

  const sendTest = useCallback(async () => {
    setTesting(true);
    setBanner(null);
    try {
      const res = await fetch("/api/push/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        delivered?: number;
      };
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : "Could not send test notification.",
        );
      }
      setBanner(
        `Test sent to ${data.delivered ?? 1} device(s). Check your system notifications (minimize this tab if needed).`,
      );
    } catch (e) {
      setBanner(e instanceof Error ? e.message : "Test notification failed.");
    } finally {
      setTesting(false);
    }
  }, []);

  return (
    <div className="mt-6 space-y-3 border-t border-[var(--outline-variant)] pt-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Label className="text-sm font-bold text-[var(--on-surface)]">
            Browser push for deadlines & reminders
          </Label>
          <p className="mt-1 text-xs text-[var(--on-surface-variant)]">
            Get the same deadline and reminder alerts in your browser when the
            tab is closed. Email notifications still send when mail is configured.
          </p>
          <p
            className={cn(
              "mt-2 text-xs",
              push.permission === "denied"
                ? "text-destructive"
                : "text-[var(--on-surface-variant)]",
            )}
          >
            Status: {push.statusLabel}
          </p>
          {push.error ? (
            <p className="mt-1 text-xs text-destructive">{push.error}</p>
          ) : null}
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={enabled}
            disabled={
              push.busy ||
              saving ||
              push.permission === "unsupported" ||
              push.permission === "denied"
            }
            onChange={(e) => void togglePush(e.target.checked)}
          />
          <span>Enable push</span>
        </label>
      </div>

      {needsPermission ? (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={push.busy || saving}
          onClick={() => void togglePush(true)}
        >
          {push.busy ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              Enabling…
            </>
          ) : (
            "Allow browser notifications"
          )}
        </Button>
      ) : null}

      {enabled && push.permission === "granted" ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={testing || push.busy || saving}
          onClick={() => void sendTest()}
        >
          {testing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              Sending test…
            </>
          ) : (
            "Send test notification"
          )}
        </Button>
      ) : null}

      {banner ? (
        <p className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-[var(--on-surface)]">
          {banner}
        </p>
      ) : null}
    </div>
  );
}
