"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icon";
import {
  type ConnectorRow,
  connectorsKeys,
  useConnectors,
  useDisconnect,
} from "@/features/connectors/api";

type ConnectorMeta = {
  provider: "gmail" | "google_drive";
  label: string;
  icon: string;
  startPath: string;
  apiPath: string;
  blurb: string;
  blurbConnected: (email: string | null) => React.ReactNode;
};

const CONNECTORS: ConnectorMeta[] = [
  {
    provider: "gmail",
    label: "Gmail",
    icon: "mail",
    startPath: "/api/connectors/gmail/start",
    apiPath: "/api/connectors/gmail",
    blurb: "Send cold emails from GradApply using your Google account.",
    blurbConnected: (email) => (
      <>
        Connected as{" "}
        <span className="font-bold text-[var(--on-surface)]">
          {email ?? "your mailbox"}
        </span>
      </>
    ),
  },
  {
    provider: "google_drive",
    label: "Google Drive",
    icon: "folder_open",
    startPath: "/api/connectors/google-drive/start",
    apiPath: "/api/connectors/google-drive",
    blurb:
      "Sync SOPs, outreach emails, and review sessions with Google Docs (two-way).",
    blurbConnected: (email) => (
      <>
        Connected as{" "}
        <span className="font-bold text-[var(--on-surface)]">
          {email ?? "your Google account"}
        </span>{" "}
        · Google Docs sync enabled.
      </>
    ),
  },
];

export function ConnectorsSettings({ planTier }: { planTier: string }) {
  const searchParams = useSearchParams();
  const qc = useQueryClient();
  const connectorsQuery = useConnectors();
  const disconnectMutation = useDisconnect();

  const [disconnecting, setDisconnecting] = useState<
    "gmail" | "google_drive" | null
  >(null);
  const [banner, setBanner] = useState<{
    tone: "ok" | "err";
    message: string;
  } | null>(null);

  const data = connectorsQuery.data;
  const loading = connectorsQuery.isLoading;
  const oauthConfigured: boolean | null = data
    ? data.googleOAuthConfigured !== false
    : null;
  const rows: Record<ConnectorMeta["provider"], ConnectorRow> = useMemo(() => {
    const next: Record<ConnectorMeta["provider"], ConnectorRow> = {
      gmail: {
        provider: "gmail",
        connected: false,
        email: null,
        updatedAt: null,
        docsSyncReady: null,
      },
      google_drive: {
        provider: "google_drive",
        connected: false,
        email: null,
        updatedAt: null,
        docsSyncReady: false,
      },
    };
    if (data) {
      for (const c of data.connectors) {
        if (c.provider === "gmail" || c.provider === "google_drive") {
          next[c.provider] = c;
        }
      }
    }
    return next;
  }, [data]);

  // OAuth-callback search-param banners. Trigger a refetch on success so
  // `useConnectors` reflects the new connection state immediately.
  useEffect(() => {
    const ok = searchParams.get("connector");
    const err = searchParams.get("connector_error");
    if (ok === "gmail_connected") {
      setBanner({
        tone: "ok",
        message:
          "Gmail connected. You can send professor outreach from the Emails page.",
      });
      void qc.invalidateQueries({ queryKey: connectorsKeys.all });
      return;
    }
    if (ok === "google_drive_connected") {
      setBanner({
        tone: "ok",
        message:
          "Google Drive connected. You can open writeups in Google Docs from SOP studio, emails, and review sessions.",
      });
      void qc.invalidateQueries({ queryKey: connectorsKeys.all });
      return;
    }
    if (err) {
      setBanner({
        tone: "err",
        message: decodeURIComponent(err.replace(/\+/g, " ")),
      });
    }
  }, [searchParams, qc]);

  // Surface query errors as banners.
  useEffect(() => {
    if (connectorsQuery.isError) {
      setBanner({ tone: "err", message: "Could not load connector status." });
    }
  }, [connectorsQuery.isError]);

  const disconnect = async (which: "gmail" | "google_drive") => {
    const meta = CONNECTORS.find((c) => c.provider === which)!;
    if (!confirm(`Disconnect ${meta.label} from GradApply?`)) return;
    setDisconnecting(which);
    try {
      // The mutation's `provider` arg is the URL slug ("gmail" | "google-drive"),
      // but our state key is "google_drive" — translate.
      const slug: "gmail" | "google-drive" =
        which === "google_drive" ? "google-drive" : which;
      await disconnectMutation.mutateAsync(slug);
      setBanner({ tone: "ok", message: `${meta.label} disconnected.` });
    } catch {
      setBanner({ tone: "err", message: "Could not disconnect." });
    } finally {
      setDisconnecting(null);
    }
  };

  if (planTier === "FREE") {
    return (
      <div className="rounded-2xl border-2 border-dashed border-[var(--outline-variant)] p-6 text-center">
        <Icon
          name="lock"
          size={28}
          className="text-[var(--outline)]"
        />
        <p className="mt-3 text-sm text-[var(--on-surface-variant)]">
          Connectors are available on Plus and Pro plans. Upgrade to connect
          Gmail and Google Drive.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {banner ? (
        <div
          role="status"
          className={banner.tone === "ok" ? "glass-alert-success" : "glass-alert-error"}
        >
          {banner.message}
        </div>
      ) : null}

      {oauthConfigured === false ? (
        <div className="glass-alert-warning">
          <strong className="font-bold">Google OAuth not configured.</strong>{" "}
          Set <CodeChip>GOOGLE_CLIENT_ID</CodeChip> /{" "}
          <CodeChip>GOOGLE_CLIENT_SECRET</CodeChip> in <CodeChip>.env</CodeChip>{" "}
          on the server, then restart.
        </div>
      ) : null}

      <div className="space-y-3">
        {CONNECTORS.map((meta) => {
          const row = rows[meta.provider];
          const isDisconnecting = disconnecting === meta.provider;
          const canConnect =
            !loading && oauthConfigured === true && !row.connected;

          return (
            <div
              key={meta.provider}
              className="flex flex-col gap-4 rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-start gap-3">
                <div
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-xl"
                  style={{
                    background: row.connected
                      ? "var(--tertiary-fixed)"
                      : "rgba(0,98,157,0.08)",
                    color: row.connected
                      ? "var(--on-tertiary-container)"
                      : "var(--primary)",
                  }}
                >
                  <Icon name={meta.icon} fill={row.connected} size={22} />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-[var(--on-surface)]">
                      {meta.label}
                    </span>
                    {row.connected ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-[var(--tertiary)]/30 bg-[var(--tertiary-fixed)]/40 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.08em] text-[var(--tertiary)]">
                        <Icon name="check_circle" fill size={11} />
                        Connected
                      </span>
                    ) : null}
                  </div>
                  <p className="m-0 mt-1 text-sm text-[var(--on-surface-variant)]">
                    {loading ? (
                      <span className="inline-flex items-center gap-2">
                        <Icon
                          name="progress_activity"
                          className="animate-spin"
                          size={14}
                        />
                        Checking status…
                      </span>
                    ) : row.connected ? (
                      meta.blurbConnected(row.email)
                    ) : (
                      meta.blurb
                    )}
                  </p>
                  {meta.provider === "google_drive" &&
                  row.connected &&
                  row.docsSyncReady === false ? (
                    <p className="mt-2 text-xs font-semibold text-[var(--error)]">
                      Reconnect to enable Google Docs sync (new permissions
                      required).
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                {row.connected ? (
                  <>
                    {meta.provider === "google_drive" &&
                    row.docsSyncReady === false ? (
                      <Button asChild size="sm" icon="sync">
                        <a href={meta.startPath}>Reconnect</a>
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={disconnecting !== null || loading}
                      loading={isDisconnecting}
                      icon="link_off"
                      onClick={() => void disconnect(meta.provider)}
                      className="border border-[var(--outline-variant)]"
                    >
                      {isDisconnecting ? "Disconnecting…" : "Disconnect"}
                    </Button>
                  </>
                ) : canConnect ? (
                  <Button asChild size="sm" icon="login">
                    <a href={meta.startPath}>Connect {meta.label}</a>
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    disabled
                    icon="login"
                    title={
                      oauthConfigured === false
                        ? "Server missing Google OAuth env vars"
                        : undefined
                    }
                  >
                    Connect {meta.label}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CodeChip({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded-md bg-[var(--surface-container)] px-1.5 py-0.5 font-mono text-[0.7rem] text-[var(--on-surface)]">
      {children}
    </code>
  );
}
