"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Loader2, Send, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type EmailStatus =
  | "DRAFT"
  | "SENT"
  | "REPLIED"
  | "NO_REPLY"
  | "NOT_INTERESTED";

type EmailRow = {
  id: string;
  profName: string | null;
  profEmail: string | null;
  university: string | null;
  profileUrl: string | null;
  researchArea: string | null;
  emailSubject: string | null;
  emailBody: string | null;
  status: EmailStatus;
  notes: string | null;
};

type DocType = "cv" | "transcript" | "gre";
type DocumentRow = {
  id: string;
  name: string;
  type: string;
};

const ATTACHMENT_NONE = "__none__";
const statuses: EmailStatus[] = [
  "DRAFT",
  "SENT",
  "REPLIED",
  "NO_REPLY",
  "NOT_INTERESTED",
];

export default function EmailsPage() {
  const [rows, setRows] = useState<EmailRow[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafting, setDrafting] = useState<string | null>(null);
  const [profileUrlInput, setProfileUrlInput] = useState("");
  const [working, setWorking] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [gmailConnected, setGmailConnected] = useState(false);
  /** False when deployer omitted GOOGLE_CLIENT_ID / SECRET (connectors unavailable). */
  const [googleOAuthConfigured, setGoogleOAuthConfigured] = useState(true);
  const [sendingViaGmail, setSendingViaGmail] = useState(false);
  const [attachmentSelection, setAttachmentSelection] = useState<{
    cv: string;
    transcript: string;
    gre: string;
  }>({
    cv: ATTACHMENT_NONE,
    transcript: ATTACHMENT_NONE,
    gre: ATTACHMENT_NONE,
  });

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/prof-emails");
    if (res.ok) setRows(await res.json());
    setLoading(false);
  };

  const loadDocuments = async () => {
    const res = await fetch("/api/documents");
    if (!res.ok) return;
    const rows = (await res.json()) as DocumentRow[];
    setDocuments(rows);
  };

  useEffect(() => {
    void load();
    void loadDocuments();
  }, []);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/connectors");
      if (!res.ok) return;
      const data = (await res.json()) as {
        googleOAuthConfigured?: boolean;
        connectors: { provider: string; connected: boolean }[];
      };
      setGoogleOAuthConfigured(data.googleOAuthConfigured !== false);
      const g = data.connectors.find((c) => c.provider === "gmail");
      setGmailConnected(Boolean(g?.connected));
    })();
  }, []);

  useEffect(() => {
    setSelectedId((prev) => {
      if (rows.length === 0) return null;
      if (prev && rows.some((r) => r.id === prev)) return prev;
      return rows[0].id;
    });
  }, [rows]);

  const selected = rows.find((r) => r.id === selectedId) ?? null;

  const analyzeFromUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = profileUrlInput.trim();
    if (!url) return;
    setWorking(true);
    const res = await fetch("/api/prof-emails/from-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileUrl: url }),
    });
    setWorking(false);
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: unknown };
      const msg =
        typeof j.error === "string"
          ? j.error
          : "Could not analyze this URL. Try a public faculty directory or profile page.";
      alert(msg);
      return;
    }
    const created = (await res.json()) as EmailRow;
    setProfileUrlInput("");
    await load();
    setSelectedId(created.id);
  };

  const patch = async (id: string, body: Record<string, unknown>) => {
    const res = await fetch(`/api/prof-emails/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) await load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this outreach record?")) return;
    const res = await fetch(`/api/prof-emails/${id}`, { method: "DELETE" });
    if (res.ok) await load();
  };

  const docsForType = (type: DocType) =>
    documents.filter((d) => d.type === type);

  const sendViaGmail = async (id: string) => {
    setSendingViaGmail(true);
    try {
      const attachmentDocumentIds = [
        attachmentSelection.cv,
        attachmentSelection.transcript,
        attachmentSelection.gre,
      ].filter((v) => v !== ATTACHMENT_NONE);

      const res = await fetch(`/api/prof-emails/${id}/send-via-gmail`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attachmentDocumentIds }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        alert(j.error ?? "Could not send via Gmail.");
        return;
      }
      await load();
      setGmailConnected(true);
    } finally {
      setSendingViaGmail(false);
    }
  };

  const aiDraft = async (id: string) => {
    setDrafting(id);
    const res = await fetch(`/api/prof-emails/${id}/draft`, {
      method: "POST",
    });
    setDrafting(null);
    if (res.ok) await load();
    else {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      alert(
        j.error ??
          "Regeneration failed. Add a profile URL or set OPENROUTER_API_KEY or ANTHROPIC_API_KEY.",
      );
    }
  };

  return (
    <div className="mx-auto max-w-[1380px] space-y-8 pb-10">
      <header className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary/90">
          Scholar outreach
        </p>
        <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
          Professor cold email
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Paste a faculty URL in the curator — the model extracts details and drafts from your{" "}
          <Link href="/profile" className="text-primary underline-offset-4 hover:underline">
            research interests
          </Link>
          . Edit the manuscript before sending.
        </p>
        {!googleOAuthConfigured ? (
          <p className="max-w-2xl text-sm text-amber-200/90">
            This deployment has not set <code className="text-xs">GOOGLE_CLIENT_ID</code> /{" "}
            <code className="text-xs">GOOGLE_CLIENT_SECRET</code>—ask whoever runs the site.
            When added, <strong>you</strong> connect <strong>your</strong> Gmail in Settings;
            tokens stay on your account only.
          </p>
        ) : !gmailConnected ? (
          <p className="max-w-2xl text-sm text-amber-200/90">
            <Link href="/settings" className="font-medium text-primary underline-offset-4 hover:underline">
              Connect your Gmail in Settings
            </Link>{" "}
            to send drafts from your mailbox (stored only for your user).
          </p>
        ) : null}
      </header>

      <div className="flex flex-col gap-8 xl:flex-row xl:items-start">
        {/* Manuscript workspace — left on xl */}
        <section className="order-2 min-w-0 flex-1 xl:order-1">
          {loading ? (
            <div className="scholar-manuscript text-sm text-muted-foreground">
              Loading…
            </div>
          ) : !selected ? (
            <div className="scholar-manuscript space-y-3 text-muted-foreground">
              <p className="font-display text-lg text-foreground/90">No draft selected</p>
              <p className="text-sm">
                Add a professor URL in the curator, or pick a thread from the list.
              </p>
            </div>
          ) : (
            <Card key={selected.id} className="glass-panel border-amber-500/15">
              <CardHeader className="border-b border-white/10 pb-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="font-display text-2xl font-semibold tracking-tight">
                      Manuscript
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {selected.profName ?? "Professor"} · {selected.university ?? "Institution"}
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="border-primary/40 text-primary">
                      {selected.status.replaceAll("_", " ")}
                    </Badge>
                    <Button
                      size="sm"
                      variant="default"
                      disabled={
                        sendingViaGmail ||
                        !googleOAuthConfigured ||
                        !gmailConnected ||
                        !selected.profEmail?.trim() ||
                        !selected.emailSubject?.trim() ||
                        !selected.emailBody?.trim()
                      }
                      title={
                        !googleOAuthConfigured
                          ? "Google OAuth not configured on this server"
                          : !gmailConnected
                            ? "Connect your Gmail under Settings first"
                            : !selected.profEmail?.trim()
                              ? "Add professor email"
                              : undefined
                      }
                      onClick={() => void sendViaGmail(selected.id)}
                    >
                      {sendingViaGmail ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                      ) : (
                        <Send className="mr-2 h-4 w-4" aria-hidden />
                      )}
                      {sendingViaGmail ? "Sending…" : "Send via Gmail"}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={drafting === selected.id || !selected.profileUrl?.trim()}
                      title={
                        selected.profileUrl?.trim()
                          ? undefined
                          : "Add a profile URL in the fields below"
                      }
                      onClick={() => aiDraft(selected.id)}
                    >
                      <Sparkles className="mr-2 h-4 w-4" />
                      {drafting === selected.id ? "Working…" : "Regenerate"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="Delete"
                      onClick={() => remove(selected.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor={`profName-${selected.id}`}>Professor name</Label>
                    <Input
                      id={`profName-${selected.id}`}
                      className="border-white/15 bg-black/20"
                      defaultValue={selected.profName ?? ""}
                      onBlur={(e) =>
                        patch(selected.id, {
                          profName: e.target.value.trim() || null,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`profEmail-${selected.id}`}>Professor email</Label>
                    <Input
                      id={`profEmail-${selected.id}`}
                      type="email"
                      className="border-white/15 bg-black/20"
                      defaultValue={selected.profEmail ?? ""}
                      placeholder="If missing from page"
                      onBlur={(e) =>
                        patch(selected.id, {
                          profEmail: e.target.value.trim() || null,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor={`university-${selected.id}`}>University / department</Label>
                    <Input
                      id={`university-${selected.id}`}
                      className="border-white/15 bg-black/20"
                      defaultValue={selected.university ?? ""}
                      onBlur={(e) =>
                        patch(selected.id, {
                          university: e.target.value.trim() || null,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor={`researchArea-${selected.id}`}>
                      Their research (from page)
                    </Label>
                    <Input
                      id={`researchArea-${selected.id}`}
                      className="border-white/15 bg-black/20"
                      defaultValue={selected.researchArea ?? ""}
                      onBlur={(e) =>
                        patch(selected.id, {
                          researchArea: e.target.value.trim() || null,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor={`profileUrl-${selected.id}`}>Source profile URL</Label>
                    <Input
                      id={`profileUrl-${selected.id}`}
                      type="url"
                      className="border-white/15 bg-black/20"
                      defaultValue={selected.profileUrl ?? ""}
                      onBlur={(e) =>
                        patch(selected.id, {
                          profileUrl: e.target.value.trim() || null,
                        })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Subject line</Label>
                  <Input
                    className="border-white/15 bg-black/20 font-medium"
                    defaultValue={selected.emailSubject ?? ""}
                    onBlur={(e) =>
                      patch(selected.id, { emailSubject: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email body</Label>
                  <Textarea
                    className="font-display min-h-[280px] resize-y border-white/15 bg-black/25 text-[15px] leading-relaxed text-foreground/95"
                    defaultValue={selected.emailBody ?? ""}
                    onBlur={(e) => patch(selected.id, { emailBody: e.target.value })}
                  />
                </div>

                <div className="space-y-3 rounded-lg border border-white/10 bg-black/15 p-3">
                  <Label className="text-sm font-medium">Attachments (optional)</Label>
                  <p className="text-xs text-muted-foreground">
                    Pick files to attach when sending via Gmail. Supported here: CV,
                    transcript, GRE.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">CV</Label>
                      <Select
                        value={attachmentSelection.cv}
                        onValueChange={(v) =>
                          setAttachmentSelection((prev) => ({ ...prev, cv: v }))
                        }
                      >
                        <SelectTrigger className="border-white/15 bg-black/20">
                          <SelectValue placeholder="Select CV" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={ATTACHMENT_NONE}>No attachment</SelectItem>
                          {docsForType("cv").map((doc) => (
                            <SelectItem key={doc.id} value={doc.id}>
                              {doc.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Transcript</Label>
                      <Select
                        value={attachmentSelection.transcript}
                        onValueChange={(v) =>
                          setAttachmentSelection((prev) => ({
                            ...prev,
                            transcript: v,
                          }))
                        }
                      >
                        <SelectTrigger className="border-white/15 bg-black/20">
                          <SelectValue placeholder="Select transcript" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={ATTACHMENT_NONE}>No attachment</SelectItem>
                          {docsForType("transcript").map((doc) => (
                            <SelectItem key={doc.id} value={doc.id}>
                              {doc.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">GRE score</Label>
                      <Select
                        value={attachmentSelection.gre}
                        onValueChange={(v) =>
                          setAttachmentSelection((prev) => ({ ...prev, gre: v }))
                        }
                      >
                        <SelectTrigger className="border-white/15 bg-black/20">
                          <SelectValue placeholder="Select GRE file" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={ATTACHMENT_NONE}>No attachment</SelectItem>
                          {docsForType("gre").map((doc) => (
                            <SelectItem key={doc.id} value={doc.id}>
                              {doc.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select
                      value={selected.status}
                      onValueChange={(v) =>
                        patch(selected.id, { status: v as EmailStatus })
                      }
                    >
                      <SelectTrigger className="border-white/15 bg-black/20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {statuses.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s.replaceAll("_", " ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Your notes</Label>
                    <Textarea
                      className="min-h-[80px] border-white/15 bg-black/20"
                      defaultValue={selected.notes ?? ""}
                      onBlur={(e) => patch(selected.id, { notes: e.target.value })}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </section>

        {/* AI Curator — top on mobile, right on xl */}
        <aside className="order-1 w-full shrink-0 space-y-4 xl:sticky xl:top-6 xl:order-2 xl:w-[min(100%,380px)]">
          <Card className="glass-panel border-amber-500/20">
            <CardHeader>
              <CardTitle className="font-display text-xl">AI curator</CardTitle>
              <CardDescription>
                Fetch the page, extract the professor, align with your profile interests, draft the
                email.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={analyzeFromUrl}>
                <div className="space-y-2">
                  <Label htmlFor="faculty-url">Faculty or lab URL</Label>
                  <Input
                    id="faculty-url"
                    type="url"
                    inputMode="url"
                    required
                    placeholder="https://…"
                    value={profileUrlInput}
                    onChange={(e) => setProfileUrlInput(e.target.value)}
                    disabled={working}
                    className="border-white/15 bg-black/25"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={working || !profileUrlInput.trim()}
                >
                  {working ? "Analyzing…" : "Analyze & draft"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="glass-panel">
            <CardHeader className="py-4">
              <CardTitle className="font-display text-lg">Threads</CardTitle>
              <CardDescription>Select a draft to edit in the manuscript.</CardDescription>
            </CardHeader>
            <CardContent className="pb-4 pt-0">
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">No threads yet.</p>
              ) : (
                <ScrollArea className="h-[min(52vh,420px)] pr-3">
                  <ul className="space-y-2">
                    {rows.map((row) => (
                      <li key={row.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(row.id)}
                          className={cn(
                            "w-full rounded-xl border px-3 py-3 text-left transition-colors",
                            row.id === selectedId
                              ? "border-primary/50 bg-primary/10 ring-1 ring-primary/35"
                              : "border-white/10 bg-black/15 hover:border-white/20 hover:bg-black/25",
                          )}
                        >
                          <div className="font-medium text-foreground">
                            {row.profName ?? "Professor"}
                          </div>
                          <div className="truncate text-xs text-muted-foreground">
                            {row.university ?? "—"}
                            {row.profEmail ? ` · ${row.profEmail}` : ""}
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
