"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { FolderOpen, Loader2, Mail, PlugZap } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type ConnectorRow = {
  provider: "gmail" | "google_drive";
  connected: boolean;
  email: string | null;
};

export function ConnectorsSettings() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [gmail, setGmail] = useState<ConnectorRow>({
    provider: "gmail",
    connected: false,
    email: null,
  });
  const [drive, setDrive] = useState<ConnectorRow>({
    provider: "google_drive",
    connected: false,
    email: null,
  });
  const [disconnecting, setDisconnecting] = useState<
    "gmail" | "google_drive" | null
  >(null);
  /** null = still loading from API */
  const [oauthConfigured, setOauthConfigured] = useState<boolean | null>(null);
  const [banner, setBanner] = useState<{
    tone: "ok" | "err";
    message: string;
  } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/connectors");
      if (!res.ok) throw new Error("failed");
      const data = (await res.json()) as {
        googleOAuthConfigured?: boolean;
        connectors: ConnectorRow[];
      };
      setOauthConfigured(data.googleOAuthConfigured !== false);
      const g = data.connectors.find((c) => c.provider === "gmail");
      const d = data.connectors.find((c) => c.provider === "google_drive");
      if (g) setGmail(g);
      if (d) setDrive(d);
    } catch {
      setBanner({ tone: "err", message: "Could not load connector status." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const ok = searchParams.get("connector");
    const err = searchParams.get("connector_error");
    if (ok === "gmail_connected") {
      setBanner({
        tone: "ok",
        message:
          "Gmail connected. You can send professor outreach from the Emails page.",
      });
      void load();
      return;
    }
    if (ok === "google_drive_connected") {
      setBanner({
        tone: "ok",
        message:
          "Google Drive connected. Document import from Drive can use this link later.",
      });
      void load();
      return;
    }
    if (err) {
      setBanner({
        tone: "err",
        message: decodeURIComponent(err.replace(/\+/g, " ")),
      });
    }
  }, [searchParams]);

  const disconnect = async (which: "gmail" | "google_drive") => {
    const label = which === "gmail" ? "Gmail" : "Google Drive";
    if (!confirm(`Disconnect ${label} from GradApply?`)) return;
    setDisconnecting(which);
    try {
      const path =
        which === "gmail"
          ? "/api/connectors/gmail"
          : "/api/connectors/google-drive";
      const res = await fetch(path, { method: "DELETE" });
      if (!res.ok) throw new Error("disconnect_failed");
      if (which === "gmail") {
        setGmail({ provider: "gmail", connected: false, email: null });
      } else {
        setDrive({ provider: "google_drive", connected: false, email: null });
      }
      setBanner({ tone: "ok", message: `${label} disconnected.` });
    } catch {
      setBanner({ tone: "err", message: "Could not disconnect." });
    } finally {
      setDisconnecting(null);
    }
  };

  return (
    <Card className="glass-panel border-white/10">
      <CardHeader>
        <div className="flex items-center gap-2">
          <PlugZap className="h-5 w-5 text-primary" aria-hidden />
          <CardTitle className="font-display text-xl">Connectors</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {banner ? (
          <p
            role="status"
            className={
              banner.tone === "ok"
                ? "rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200"
                : "rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            }
          >
            {banner.message}
          </p>
        ) : null}

        {/* Gmail */}
        <div className="flex flex-col gap-4 rounded-xl border border-white/10 bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Mail className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <div className="font-medium">Gmail</div>
              <p className="text-sm text-muted-foreground">
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Checking status…
                  </span>
                ) : gmail.connected ? (
                  <>
                    Connected as{" "}
                    <span className="font-medium text-foreground">
                      {gmail.email ?? "your mailbox"}
                    </span>
                  </>
                ) : (
                  "Send cold emails from GradApply using your Google account."
                )}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {gmail.connected ? (
              <Button
                type="button"
                variant="outline"
                disabled={disconnecting !== null || loading}
                onClick={() => void disconnect("gmail")}
              >
                {disconnecting === "gmail" ? "Disconnecting…" : "Disconnect"}
              </Button>
            ) : oauthConfigured === false ||
              oauthConfigured === null ||
              loading ? (
              <Button
                type="button"
                disabled
                title={
                  oauthConfigured === false
                    ? "Server missing Google OAuth env vars"
                    : undefined
                }
              >
                Connect Gmail
              </Button>
            ) : (
              <Button type="button" asChild>
                <a href="/api/connectors/gmail/start">Connect Gmail</a>
              </Button>
            )}
          </div>
        </div>

        {/* Google Drive */}
        <div className="flex flex-col gap-4 rounded-xl border border-white/10 bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <FolderOpen className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <div className="font-medium">Google Drive</div>
              <p className="text-sm text-muted-foreground">
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Checking status…
                  </span>
                ) : drive.connected ? (
                  <>
                    Connected as{" "}
                    <span className="font-medium text-foreground">
                      {drive.email ?? "your Google account"}
                    </span>
                    {" "}
                    · read-only access for upcoming file import.
                  </>
                ) : (
                  "Read-only access to list and open files you choose (CVs, PDFs)."
                )}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {drive.connected ? (
              <Button
                type="button"
                variant="outline"
                disabled={disconnecting !== null || loading}
                onClick={() => void disconnect("google_drive")}
              >
                {disconnecting === "google_drive" ? "Disconnecting…" : "Disconnect"}
              </Button>
            ) : oauthConfigured === false ||
              oauthConfigured === null ||
              loading ? (
              <Button type="button" disabled>
                Connect Google Drive
              </Button>
            ) : (
              <Button type="button" asChild>
                <a href="/api/connectors/google-drive/start">
                  Connect Google Drive
                </a>
              </Button>
            )}
          </div>
        </div>

      </CardContent>
    </Card>
  );
}
