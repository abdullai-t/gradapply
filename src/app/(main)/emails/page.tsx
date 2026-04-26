"use client";

import Link from "next/link";
import { format } from "date-fns";
import { createTwoFilesPatch } from "diff";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  History,
  Loader2,
  MessageSquareText,
  Search,
  Send,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  parseProfEmailSnapshot,
  profEmailSnapshotToText,
} from "@/lib/prof-email-version";
import { messageFromApiErrorPayload } from "@/lib/api-error-json";
import { useQueryClient } from "@tanstack/react-query";

import { useDocuments } from "@/features/documents/api";
import {
  contentVersionsKeys,
  profEmailsKeys,
  useProfEmails,
  useVersions,
} from "@/features/emails/api";
import { useSchools } from "@/features/schools/api";
import { useConnectors } from "@/features/connectors/api";
import { cn } from "@/lib/utils";

type EmailStatus =
  | "DRAFT"
  | "SENT"
  | "REPLIED"
  | "NO_REPLY"
  | "NOT_INTERESTED";

type ReplyIntentKind =
  | "INTERESTED"
  | "NEUTRAL"
  | "DECLINED"
  | "UNKNOWN";

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
  lastReplySnippet?: string | null;
  replyIntent?: ReplyIntentKind | null;
  suggestedReplyDraft?: string | null;
  replyRationale?: string | null;
  lastClassifiedAt?: string | null;
};

type DocType = "cv" | "transcript" | "gre";
type DocumentRow = {
  id: string;
  name: string;
  type: string;
};

type VersionRow = {
  id: string;
  label: string;
  body: string | null;
  createdAt: string;
};

const ATTACHMENT_NONE = "__none__";
const VERSION_NONE = "__version_none__";

function replyIntentBadgeClass(intent: ReplyIntentKind): string {
  switch (intent) {
    case "INTERESTED":
      return "border-[var(--tertiary)]/45 bg-[var(--tertiary-container)]/15 text-[var(--tertiary)]";
    case "DECLINED":
      return "border-[var(--error)]/40 bg-[var(--error-container)] text-[var(--on-error-container)]";
    case "NEUTRAL":
      return "border-[var(--streak-orange)]/40 bg-[var(--streak-orange-soft)] text-[#7a3a08] dark:text-[var(--streak-orange)]";
    default:
      return "border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] text-muted-foreground";
  }
}

function replyIntentLabel(intent: ReplyIntentKind): string {
  switch (intent) {
    case "INTERESTED":
      return "Interested";
    case "DECLINED":
      return "Declined";
    case "NEUTRAL":
      return "Neutral";
    default:
      return "Unknown";
  }
}

const statuses: EmailStatus[] = [
  "DRAFT",
  "SENT",
  "REPLIED",
  "NO_REPLY",
  "NOT_INTERESTED",
];

export default function EmailsPage() {
  const qc = useQueryClient();

  // Cached, deduped, focus-revalidated reads. Mutations below invalidate
  // the relevant query keys instead of re-running per-page `load()` helpers.
  const profEmailsQuery = useProfEmails();
  const documentsQuery = useDocuments({});
  const schoolsQueryRaw = useSchools();
  const connectorsQuery = useConnectors();

  const rows: EmailRow[] = useMemo(
    () => (profEmailsQuery.data ?? []) as EmailRow[],
    [profEmailsQuery.data],
  );
  const documents: DocumentRow[] = useMemo(() => {
    const pages = documentsQuery.data?.pages ?? [];
    return pages.flatMap((p) => (p.items as unknown) as DocumentRow[]);
  }, [documentsQuery.data]);
  const loading = profEmailsQuery.isLoading;

  const [drafting, setDrafting] = useState<string | null>(null);
  const [profileUrlInput, setProfileUrlInput] = useState("");
  const [working, setWorking] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const gmailConnected = useMemo(() => {
    const list = connectorsQuery.data?.connectors ?? [];
    return Boolean(list.find((c) => c.provider === "gmail")?.connected);
  }, [connectorsQuery.data]);
  /** Bridges the legacy `setGmailConnected(true)` call site after a successful
   * OAuth pop-up — invalidates the cache so `useConnectors` refetches. */
  const refreshConnectors = () =>
    void qc.invalidateQueries({ queryKey: ["connectors"] });
  /** False when deployer omitted GOOGLE_CLIENT_ID / SECRET (connectors unavailable). */
  const googleOAuthConfigured =
    connectorsQuery.data?.googleOAuthConfigured !== false;
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

  const [draftSubject, setDraftSubject] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [saveVersionOpen, setSaveVersionOpen] = useState(false);
  const [saveVersionLabel, setSaveVersionLabel] = useState("");
  const [savingVersion, setSavingVersion] = useState(false);
  const [compareLeftId, setCompareLeftId] = useState("");
  const [compareRightId, setCompareRightId] = useState("");
  const [restoreVersionId, setRestoreVersionId] = useState("");
  const [replyPasteText, setReplyPasteText] = useState("");
  const [suggestedDraftEdit, setSuggestedDraftEdit] = useState("");
  const [analyzingReply, setAnalyzingReply] = useState(false);

  type SchoolPick = { id: string; name: string; program: string; degree: string };
  const schools: SchoolPick[] = useMemo(() => {
    const list = (schoolsQueryRaw.data ?? []) as Array<{
      id: string;
      name: string;
      program: string;
      degree: string;
    }>;
    return list.map((s) => ({
      id: s.id,
      name: s.name,
      program: s.program,
      degree: s.degree,
    }));
  }, [schoolsQueryRaw.data]);
  const [selectedSchoolIds, setSelectedSchoolIds] = useState<string[]>([]);
  type DiscoveryCand = {
    name: string;
    profileUrl: string | null;
    profEmail: string | null;
    researchArea: string | null;
    schoolId: string | null;
    targetSchoolLabel: string | null;
    matchScore: number;
    rationale: string;
    source: "page_link" | "page_text" | "school_program";
  };
  const [discoveryCandidates, setDiscoveryCandidates] = useState<DiscoveryCand[]>(
    [],
  );
  const [discoveryAdvisory, setDiscoveryAdvisory] = useState<string | null>(null);
  /** Set after a schools-only suggestion run so empty-state hints match the flow. */
  const [discoverySchoolRun, setDiscoverySchoolRun] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [draftingDiscoverId, setDraftingDiscoverId] = useState<string | null>(
    null,
  );
  const [threadQuery, setThreadQuery] = useState("");

  const toggleSchool = (id: string) => {
    setSelectedSchoolIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  // `load()` and `loadDocuments()` are kept as thin shims that invalidate
  // the relevant TanStack Query caches. Existing call sites in mutations
  // below (`await load()`) keep their semantics: data refetches and the
  // component re-renders.
  const load = async () => {
    await qc.invalidateQueries({ queryKey: profEmailsKeys.all });
  };
  // Initial mount fetch is now handled by the `useProfEmails`,
  // `useDocuments`, `useSchools`, `useConnectors` hooks above — no
  // ad-hoc useEffect required.

  useEffect(() => {
    if (!selectedId) return;
    const row = rows.find((r) => r.id === selectedId);
    if (!row) return;
    setDraftSubject(row.emailSubject ?? "");
    setDraftBody(row.emailBody ?? "");
  }, [selectedId, rows]);

  useEffect(() => {
    setCompareLeftId("");
    setCompareRightId("");
    setRestoreVersionId("");
  }, [selectedId]);

  useEffect(() => {
    setReplyPasteText("");
  }, [selectedId]);

  useEffect(() => {
    const row = rows.find((r) => r.id === selectedId);
    setSuggestedDraftEdit(row?.suggestedReplyDraft ?? "");
  }, [selectedId, rows]);

  // `useVersions` runs only when an email is selected (enabled flag).
  // Local `versions` state above is kept as a write-through cache for the
  // diff viewer, mirrored from the query result.
  const versionsQuery = useVersions({
    entityType: "PROF_EMAIL",
    entityId: selectedId ?? "",
  });
  useEffect(() => {
    setVersions((versionsQuery.data ?? []) as VersionRow[]);
    setVersionsLoading(versionsQuery.isLoading);
  }, [versionsQuery.data, versionsQuery.isLoading]);
  const loadVersions = useCallback(async () => {
    await qc.invalidateQueries({
      queryKey: contentVersionsKeys.list("PROF_EMAIL", selectedId ?? ""),
    });
  }, [qc, selectedId]);

  // Connector status is supplied by `useConnectors()` above; no ad-hoc
  // useEffect required here.

  useEffect(() => {
    setSelectedId((prev) => {
      if (rows.length === 0) return null;
      if (prev && rows.some((r) => r.id === prev)) return prev;
      return rows[0].id;
    });
  }, [rows]);

  const selected = rows.find((r) => r.id === selectedId) ?? null;
  const filteredRows = useMemo(() => {
    const q = threadQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const haystack = [
        row.profName ?? "",
        row.university ?? "",
        row.profEmail ?? "",
        row.researchArea ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [rows, threadQuery]);

  const textDiff = useMemo(() => {
    if (!compareLeftId || !compareRightId || compareLeftId === compareRightId) {
      return null;
    }
    const L = versions.find((v) => v.id === compareLeftId);
    const R = versions.find((v) => v.id === compareRightId);
    if (!L || !R) return null;
    const pL = parseProfEmailSnapshot(L.body) ?? {
      emailSubject: null,
      emailBody: null,
    };
    const pR = parseProfEmailSnapshot(R.body) ?? {
      emailSubject: null,
      emailBody: null,
    };
    const tL = profEmailSnapshotToText(pL);
    const tR = profEmailSnapshotToText(pR);
    return createTwoFilesPatch(
      L.label,
      R.label,
      tL,
      tR,
      "",
      "",
      { context: 2 },
    );
  }, [compareLeftId, compareRightId, versions]);

  const submitSaveVersion = async () => {
    if (!selected || !saveVersionLabel.trim()) return;
    setSavingVersion(true);
    try {
      const res = await fetch("/api/content-versions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType: "PROF_EMAIL",
          entityId: selected.id,
          label: saveVersionLabel.trim(),
          emailSubject: draftSubject,
          emailBody: draftBody,
        }),
      });
      if (res.ok) {
        setSaveVersionLabel("");
        setSaveVersionOpen(false);
        await loadVersions();
      } else {
        const j = (await res.json().catch(() => ({}))) as { error?: unknown };
        const msg =
          typeof j.error === "string"
            ? j.error
            : "Could not save this version.";
        alert(msg);
      }
    } finally {
      setSavingVersion(false);
    }
  };

  const restoreFromVersion = async () => {
    if (!restoreVersionId) return;
    if (
      !confirm(
        "Replace the current subject and body on the server with this saved version?",
      )
    ) {
      return;
    }
    const res = await fetch(
      `/api/content-versions/${restoreVersionId}/restore`,
      { method: "POST" },
    );
    if (res.ok) {
      await load();
      await loadVersions();
    } else {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      alert(j.error ?? "Could not restore this version.");
    }
  };

  const analyzeReply = async () => {
    if (!selected?.id) return;
    const t = replyPasteText.trim();
    if (t.length < 20) {
      alert("Paste at least 20 characters of the professor's reply.");
      return;
    }
    setAnalyzingReply(true);
    try {
      const res = await fetch(`/api/prof-emails/${selected.id}/analyze-reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ replyText: t }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        alert(j.error ?? "Analysis failed.");
        return;
      }
      await load();
      await loadVersions();
    } finally {
      setAnalyzingReply(false);
    }
  };

  const analyzeFromUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = profileUrlInput.trim();
    if (!url) return;
    setWorking(true);
    try {
      const res = await fetch("/api/prof-emails/from-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileUrl: url }),
      });
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
      /** Keep URL in the field if you want to paste another page after this run. */
      await load();
      setSelectedId(created.id);
    } finally {
      setWorking(false);
    }
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

  const discoverSchoolsBlocked = discovering || working || selectedSchoolIds.length === 0;

  const discoverSchoolsBlockedReason = (() => {
    if (selectedSchoolIds.length === 0)
      return "Select at least one school from your shortlist.";
    return null;
  })();

  const analyzeUrlBlocked = working || !profileUrlInput.trim();

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
      refreshConnectors();
    } finally {
      setSendingViaGmail(false);
    }
  };

  const discoverFacultyFromSchools = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedSchoolIds.length === 0) {
      alert("Select at least one school.");
      return;
    }
    setDiscovering(true);
    setDiscoveryAdvisory(null);
    setDiscoveryCandidates([]);
    setDiscoverySchoolRun(false);
    try {
      const res = await fetch("/api/prof-emails/discover-by-schools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolIds: selectedSchoolIds,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(
          typeof data.error === "string"
            ? data.error
            : "Could not suggest faculty. Check your schools list or profile.",
        );
        return;
      }
      const list = Array.isArray(data.candidates)
        ? (data.candidates as DiscoveryCand[])
        : [];
      setDiscoveryCandidates(list);
      setDiscoveryAdvisory(
        typeof data.advisory === "string" ? data.advisory : null,
      );
      setDiscoverySchoolRun(true);
    } finally {
      setDiscovering(false);
    }
  };

  const draftFromDiscovery = async (c: DiscoveryCand) => {
    const key = `${c.name}\0${c.profileUrl ?? ""}`;
    setDraftingDiscoverId(key);
    try {
      const univ =
        schools.find((s) => s.id === c.schoolId)?.name ??
        c.targetSchoolLabel ??
        "University";
      const create = await fetch("/api/prof-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profName: c.name,
          profEmail: c.profEmail,
          university: univ,
          profileUrl: c.profileUrl,
          researchArea: c.researchArea,
        }),
      });
      const payload = await create.json().catch(() => ({}));
      if (!create.ok) {
        alert(messageFromApiErrorPayload(payload));
        return;
      }
      const created = payload as EmailRow;
      const draftRes = await fetch(`/api/prof-emails/${created.id}/draft`, {
        method: "POST",
      });
      if (!draftRes.ok) {
        const j = (await draftRes.json().catch(() => ({}))) as {
          error?: string;
        };
        alert(j.error ?? "Could not generate tailored email.");
        await load();
        setSelectedId(created.id);
        return;
      }
      await load();
      setSelectedId(created.id);
    } finally {
      setDraftingDiscoverId(null);
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
          <strong className="font-medium text-foreground/90">Option 1:</strong> paste one professor
          profile URL—we fetch context and draft a cold email.
          <strong className="ml-1 font-medium text-foreground/90">Option 2:</strong> pick schools from
          your tracker; we suggest faculty aligned with your{" "}
          <Link href="/profile" className="text-primary underline-offset-4 hover:underline">
            profile research interests
          </Link>
          . Verify every name on the official directory before sending.
        </p>
        {!googleOAuthConfigured ? (
          <p className="max-w-2xl text-sm text-[#7a3a08] dark:text-[var(--streak-orange)]">
            This deployment has not set <code className="text-xs">GOOGLE_CLIENT_ID</code> /{" "}
            <code className="text-xs">GOOGLE_CLIENT_SECRET</code>—ask whoever runs the site.
            When added, <strong>you</strong> connect <strong>your</strong> Gmail in Settings;
            tokens stay on your account only.
          </p>
        ) : !gmailConnected ? (
          <p className="max-w-2xl text-sm text-[#7a3a08] dark:text-[var(--streak-orange)]">
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
            <div className="scholar-manuscript rounded-2xl border border-dashed border-[var(--outline-variant)] bg-gradient-to-b from-[var(--surface-container-low)] to-[var(--surface-container-lowest)] p-8 md:p-10">
              <div className="mx-auto max-w-lg text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 ring-1 ring-primary/25">
                  <Sparkles className="h-6 w-6 text-primary" aria-hidden />
                </div>
                <p className="font-display text-xl font-semibold tracking-tight text-foreground">
                  No draft selected yet
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Use <strong className="font-medium text-foreground/90">Find faculty</strong>{" "}
                  on the right (or below on mobile): either paste one professor URL for a quick draft,
                  or select schools to get suggestions from your profile—then open a thread here from
                  the list.
                </p>
                <ol className="mt-6 space-y-3 text-left text-sm text-muted-foreground">
                  <li className="flex gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-foreground">
                      1
                    </span>
                    <span>
                      <strong className="text-foreground/90">Option 1:</strong> paste a faculty profile
                      URL and run <strong className="text-foreground/90">Quick draft from URL</strong>.
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-foreground">
                      2
                    </span>
                    <span>
                      <strong className="text-foreground/90">Option 2:</strong> select schools and run{" "}
                      <strong className="text-foreground/90">Suggest faculty from schools</strong>—then
                      tap <strong className="text-foreground/90">Draft</strong> on a row.
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-foreground">
                      3
                    </span>
                    <span>
                      Verify names on the official site; edit the manuscript and send when ready.
                    </span>
                  </li>
                </ol>
                <p className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                  Threads you create appear in the sidebar list.
                </p>
                <Button
                  asChild
                  variant="outline"
                  className="mt-4 border-[var(--outline-variant)] bg-[var(--surface-container-low)]"
                >
                  <a href="#find-faculty-panel">Go to Find faculty</a>
                </Button>
              </div>
            </div>
          ) : (
            <Card key={selected.id} className="glass-panel border-[var(--outline-variant)]">
              <CardHeader className="border-b border-[var(--outline-variant)] pb-4">
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
                        !draftSubject?.trim() ||
                        !draftBody?.trim()
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
                      disabled={drafting === selected.id}
                      title={
                        selected.profileUrl?.trim()
                          ? "Refresh the draft using your profile URL and interests"
                          : "Draft from professor name, university, and research area (add a profile URL below for a richer draft)"
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
                <div className="space-y-3 rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-foreground/90">Versions</p>
                    {versionsLoading ? (
                      <span className="text-xs text-muted-foreground">Loading…</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {versions.length} saved
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Name a snapshot of the current subject and body, compare any two, or
                    restore the server draft from a past save.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setSaveVersionLabel("");
                        setSaveVersionOpen(true);
                      }}
                    >
                      <History className="mr-2 h-4 w-4" aria-hidden />
                      Save version
                    </Button>
                    <Select
                      value={restoreVersionId || VERSION_NONE}
                      onValueChange={(v) =>
                        setRestoreVersionId(v === VERSION_NONE ? "" : v)
                      }
                    >
                      <SelectTrigger className="h-9 w-[min(100%,220px)] border-[var(--outline-variant)] bg-[var(--surface-container-low)] text-left text-sm">
                        <SelectValue placeholder="Restore from…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={VERSION_NONE}>Pick a saved version…</SelectItem>
                        {versions.map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            {format(new Date(v.createdAt), "MMM d HH:mm")} · {v.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={!restoreVersionId}
                      onClick={() => void restoreFromVersion()}
                      className="border-[var(--outline-variant)]"
                    >
                      Restore
                    </Button>
                  </div>
                  <div className="grid gap-3 pt-2 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">
                        Diff — earlier
                      </Label>
                      <Select
                        value={compareLeftId || VERSION_NONE}
                        onValueChange={(v) =>
                          setCompareLeftId(v === VERSION_NONE ? "" : v)
                        }
                      >
                        <SelectTrigger className="border-[var(--outline-variant)] bg-[var(--surface-container-low)]">
                          <SelectValue placeholder="Version A" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={VERSION_NONE}>None</SelectItem>
                          {versions.map((v) => (
                            <SelectItem key={v.id} value={v.id}>
                              {format(new Date(v.createdAt), "MMM d HH:mm")} · {v.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">
                        Diff — later
                      </Label>
                      <Select
                        value={compareRightId || VERSION_NONE}
                        onValueChange={(v) =>
                          setCompareRightId(v === VERSION_NONE ? "" : v)
                        }
                      >
                        <SelectTrigger className="border-[var(--outline-variant)] bg-[var(--surface-container-low)]">
                          <SelectValue placeholder="Version B" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={VERSION_NONE}>None</SelectItem>
                          {versions.map((v) => (
                            <SelectItem key={v.id} value={v.id}>
                              {format(new Date(v.createdAt), "MMM d HH:mm")} · {v.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {textDiff ? (
                    <ScrollArea className="max-h-[220px] rounded-md border border-[var(--outline-variant)] bg-[var(--surface-container)]">
                      <pre className="whitespace-pre-wrap break-words p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
                        {textDiff}
                      </pre>
                    </ScrollArea>
                  ) : compareLeftId && compareRightId ? (
                    <p className="text-xs text-muted-foreground">
                      Pick two different versions to view a unified diff.
                    </p>
                  ) : null}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor={`profName-${selected.id}`}>Professor name</Label>
                    <Input
                      id={`profName-${selected.id}`}
                      className="border-[var(--outline-variant)] bg-[var(--surface-container-low)]"
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
                      className="border-[var(--outline-variant)] bg-[var(--surface-container-low)]"
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
                      className="border-[var(--outline-variant)] bg-[var(--surface-container-low)]"
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
                      className="border-[var(--outline-variant)] bg-[var(--surface-container-low)]"
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
                      className="border-[var(--outline-variant)] bg-[var(--surface-container-low)]"
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
                    className="border-[var(--outline-variant)] bg-[var(--surface-container-low)] font-medium"
                    value={draftSubject}
                    onChange={(e) => setDraftSubject(e.target.value)}
                    onBlur={() =>
                      patch(selected.id, { emailSubject: draftSubject })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email body</Label>
                  <Textarea
                    className="font-display min-h-[280px] resize-y border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] text-[15px] leading-relaxed text-foreground/95"
                    value={draftBody}
                    onChange={(e) => setDraftBody(e.target.value)}
                    onBlur={() => patch(selected.id, { emailBody: draftBody })}
                  />
                </div>

                <div className="space-y-3 rounded-lg border border-[var(--primary-container)]/30 bg-[var(--surface-container-low)] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-foreground/90">
                        Their reply
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Paste the professor&apos;s message. We classify intent and save a
                        suggested follow-up on this thread.
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {selected.replyIntent ? (
                        <Badge
                          variant="outline"
                          className={replyIntentBadgeClass(
                            selected.replyIntent as ReplyIntentKind,
                          )}
                        >
                          {replyIntentLabel(selected.replyIntent as ReplyIntentKind)}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Not classified yet
                        </span>
                      )}
                      {selected.lastClassifiedAt ? (
                        <span className="text-[10px] text-muted-foreground">
                          Updated{" "}
                          {format(
                            new Date(selected.lastClassifiedAt),
                            "MMM d, yyyy HH:mm",
                          )}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`reply-paste-${selected.id}`}>Paste reply</Label>
                    <Textarea
                      id={`reply-paste-${selected.id}`}
                      className="min-h-[120px] border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] font-mono text-[13px] leading-relaxed"
                      value={replyPasteText}
                      onChange={(e) => setReplyPasteText(e.target.value)}
                      placeholder="Paste the full text of the professor's reply…"
                    />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={analyzingReply || replyPasteText.trim().length < 20}
                    title={
                      replyPasteText.trim().length < 20
                        ? "Paste at least 20 characters"
                        : undefined
                    }
                    onClick={() => void analyzeReply()}
                  >
                    {analyzingReply ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                    ) : (
                      <MessageSquareText className="mr-2 h-4 w-4" aria-hidden />
                    )}
                    {analyzingReply ? "Analyzing…" : "Analyze reply"}
                  </Button>
                  {selected.replyRationale ? (
                    <div className="rounded-md border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-3">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        Rationale
                      </p>
                      <p className="mt-1 text-sm text-foreground/90">
                        {selected.replyRationale}
                      </p>
                    </div>
                  ) : null}
                  <div className="space-y-2">
                    <Label htmlFor={`suggested-reply-${selected.id}`}>
                      Suggested follow-up (editable)
                    </Label>
                    <Textarea
                      id={`suggested-reply-${selected.id}`}
                      className="min-h-[140px] resize-y border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] text-[14px] leading-relaxed"
                      value={suggestedDraftEdit}
                      onChange={(e) => setSuggestedDraftEdit(e.target.value)}
                      onBlur={() =>
                        patch(selected.id, {
                          suggestedReplyDraft: suggestedDraftEdit || null,
                        })
                      }
                      placeholder="After analysis, edit the draft here — it saves when you leave the field."
                    />
                  </div>
                </div>

                <div className="space-y-3 rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-3">
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
                        <SelectTrigger className="border-[var(--outline-variant)] bg-[var(--surface-container-low)]">
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
                        <SelectTrigger className="border-[var(--outline-variant)] bg-[var(--surface-container-low)]">
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
                        <SelectTrigger className="border-[var(--outline-variant)] bg-[var(--surface-container-low)]">
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
                      <SelectTrigger className="border-[var(--outline-variant)] bg-[var(--surface-container-low)]">
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
                      className="min-h-[80px] border-[var(--outline-variant)] bg-[var(--surface-container-low)]"
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
        <aside className="order-1 w-full shrink-0 space-y-4 xl:sticky xl:top-6 xl:order-2 xl:w-[min(100%,420px)]">
          <Card id="find-faculty-panel" className="glass-panel border-[var(--outline-variant)]">
            <CardHeader className="space-y-2 pb-2">
              <CardTitle className="font-display text-xl">Find faculty</CardTitle>
              <CardDescription className="text-sm leading-relaxed">
                Two paths: open a draft from one professor URL, or get names from your schools plus
                profile interests (verify everyone on the official directory).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2 rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Option 1 · One professor URL
                </p>
                <Label htmlFor="faculty-url">Professor profile or lab URL</Label>
                <Input
                  id="faculty-url"
                  type="url"
                  inputMode="url"
                  placeholder="https://…faculty-page…"
                  value={profileUrlInput}
                  onChange={(e) => setProfileUrlInput(e.target.value)}
                  disabled={discovering || working}
                  className="border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] transition-colors"
                />
                <p className="text-xs leading-relaxed text-muted-foreground">
                  We fetch the page and draft a cold email—no school selection needed.
                </p>
                <form onSubmit={analyzeFromUrl}>
                  <Button
                    type="submit"
                    variant="outline"
                    className={cn(
                      "w-full border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] text-foreground hover:bg-[var(--surface-container)]",
                      analyzeUrlBlocked && "opacity-45 saturate-50",
                    )}
                    disabled={analyzeUrlBlocked}
                  >
                    {working ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                        Analyzing…
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4 opacity-90" aria-hidden />
                        Quick draft from URL
                      </>
                    )}
                  </Button>
                  {analyzeUrlBlocked && !profileUrlInput.trim() ? (
                    <p className="mt-2 text-center text-xs text-muted-foreground">
                      Paste a URL above first.
                    </p>
                  ) : null}
                </form>
              </div>

              <form
                className="space-y-4 rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-3"
                onSubmit={discoverFacultyFromSchools}
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Option 2 · Schools + your profile
                </p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label>Schools (from your tracker)</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {selectedSchoolIds.length} selected
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        disabled={selectedSchoolIds.length === 0}
                        onClick={() => setSelectedSchoolIds([])}
                      >
                        Clear
                      </Button>
                    </div>
                  </div>
                  <div className="max-h-[min(40vh,220px)] space-y-2 overflow-y-auto rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-3">
                    {schools.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        No schools yet.{" "}
                        <Link
                          href="/schools"
                          className="text-primary underline-offset-4 hover:underline"
                        >
                          Add schools
                        </Link>{" "}
                        first.
                      </p>
                    ) : (
                      schools.map((s) => (
                        <label
                          key={s.id}
                          className="flex cursor-pointer items-start gap-2 text-sm leading-snug"
                        >
                          <input
                            type="checkbox"
                            className="mt-1 h-4 w-4 shrink-0 rounded border-[var(--outline-variant)] bg-[var(--surface-container)]"
                            checked={selectedSchoolIds.includes(s.id)}
                            onChange={() => toggleSchool(s.id)}
                          />
                          <span>
                            <span className="font-medium text-foreground">{s.name}</span>
                            <span className="text-muted-foreground">
                              {" "}
                              · {s.program} · {s.degree}
                            </span>
                          </span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Button
                    type="submit"
                    className={cn(
                      "w-full font-medium shadow-md shadow-primary/15",
                      discoverSchoolsBlocked && "opacity-45 saturate-50 shadow-none",
                    )}
                    disabled={discoverSchoolsBlocked}
                  >
                    {discovering ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                        Suggesting…
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" aria-hidden />
                        Suggest faculty from schools
                      </>
                    )}
                  </Button>
                  {discovering ? (
                    <p className="text-center text-xs text-muted-foreground">
                      Matching programs to your profile interests…
                    </p>
                  ) : working ? (
                    <p className="text-center text-xs text-muted-foreground">
                      Quick draft running — wait until it finishes to run suggestions.
                    </p>
                  ) : discoverSchoolsBlockedReason ? (
                    <p className="text-center text-xs text-muted-foreground">
                      {discoverSchoolsBlockedReason}
                    </p>
                  ) : (
                    <p className="text-center text-xs text-[var(--tertiary)]">
                      Uses your profile research interests—no URL required.
                    </p>
                  )}
                </div>
              </form>

              {discoveryAdvisory ? (
                <p className="rounded-md border border-[var(--streak-orange)]/40 bg-[var(--streak-orange-soft)] px-3 py-2 text-xs text-[#7a3a08] dark:text-[var(--streak-orange)]">
                  {discoveryAdvisory}
                </p>
              ) : null}

              {discoveryCandidates.length > 0 ? (
                <div className="space-y-2 border-t border-[var(--outline-variant)] pt-4">
                  <p className="text-sm font-medium">Suggestions</p>
                  <ul className="space-y-2">
                    {discoveryCandidates.map((c, idx) => {
                      const dk = `${c.name}\0${c.profileUrl ?? ""}`;
                      const uni =
                        schools.find((x) => x.id === c.schoolId)?.name ??
                        c.targetSchoolLabel ??
                        "—";
                      return (
                        <li
                          key={`${c.name}-${idx}`}
                          className="flex items-start gap-2 rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-3 py-2 text-sm"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-foreground">{c.name}</div>
                            <div className="truncate text-xs text-muted-foreground">{uni}</div>
                            {c.researchArea ? (
                              <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                                {c.researchArea}
                              </div>
                            ) : null}
                            <div className="mt-1 flex flex-wrap gap-1">
                              <Badge variant="outline" className="text-[10px] font-normal">
                                Match {c.matchScore}/5
                              </Badge>
                              <Badge variant="secondary" className="text-[10px] font-normal">
                                {c.source === "school_program"
                                  ? "School"
                                  : c.source === "page_link"
                                    ? "Link"
                                    : "Text"}
                              </Badge>
                            </div>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            className="h-9 shrink-0 gap-1.5 px-2.5 sm:min-w-[7.5rem]"
                            disabled={draftingDiscoverId === dk}
                            title="Create a thread and generate a tailored cold email"
                            onClick={() => void draftFromDiscovery(c)}
                          >
                            {draftingDiscoverId === dk ? (
                              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                            ) : (
                              <Sparkles className="h-4 w-4" aria-hidden />
                            )}
                            <span className="hidden sm:inline">Draft</span>
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}

              {discoverySchoolRun &&
              discoveryCandidates.length === 0 &&
              !discovering ? (
                <p className="text-xs text-muted-foreground">
                  No suggestions returned—try enriching your{" "}
                  <Link href="/profile" className="text-primary underline-offset-4 hover:underline">
                    profile research interests
                  </Link>
                  , or narrow your school selection.
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card className="glass-panel">
            <CardHeader className="py-4">
              <CardTitle className="font-display text-lg">Threads</CardTitle>
              <CardDescription>Select a draft to edit in the manuscript.</CardDescription>
            </CardHeader>
            <CardContent className="pb-4 pt-0">
              <div className="mb-3 flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={threadQuery}
                    onChange={(e) => setThreadQuery(e.target.value)}
                    placeholder="Search by professor, school, or email"
                    className="h-9 border-[var(--outline-variant)] bg-[var(--surface-container-low)] pl-8 text-sm"
                  />
                </div>
                {threadQuery ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => setThreadQuery("")}
                    aria-label="Clear thread search"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">No threads yet.</p>
              ) : filteredRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">No threads match your search.</p>
              ) : (
                <ScrollArea className="h-[min(52vh,420px)] pr-3">
                  <ul className="space-y-2">
                    {filteredRows.map((row) => (
                      <li key={row.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(row.id)}
                          className={cn(
                            "w-full rounded-xl border px-3 py-3 text-left transition-colors",
                            row.id === selectedId
                              ? "border-primary/50 bg-primary/10 ring-1 ring-primary/35"
                              : "border-[var(--outline-variant)] bg-[var(--surface-container-low)] hover:border-[var(--outline)] hover:bg-[var(--surface-container-lowest)]",
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="font-medium text-foreground">
                              {row.profName ?? "Professor"}
                            </div>
                            <Badge variant="outline" className="shrink-0 border-[var(--outline-variant)] text-[10px]">
                              {row.status.replaceAll("_", " ")}
                            </Badge>
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

      <Dialog
        open={saveVersionOpen}
        onOpenChange={(o) => {
          setSaveVersionOpen(o);
          if (!o) setSaveVersionLabel("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save named version</DialogTitle>
            <DialogDescription>
              Captures the current subject and body in the form, even if you have
              not tabbed out of a field yet.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="version-label">Label</Label>
            <Input
              id="version-label"
              value={saveVersionLabel}
              onChange={(e) => setSaveVersionLabel(e.target.value)}
              placeholder="e.g. Before send, v2 for Program A"
              className="border-[var(--outline-variant)] bg-[var(--surface-container-low)]"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSaveVersionOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={savingVersion || !saveVersionLabel.trim() || !selected?.id}
              onClick={() => void submitSaveVersion()}
            >
              {savingVersion ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  Saving…
                </>
              ) : (
                "Save snapshot"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
