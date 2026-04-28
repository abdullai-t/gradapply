"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { messageFromApiErrorPayload } from "@/lib/api-error-json";
import { useQueryClient } from "@tanstack/react-query";

import {
  contentVersionsKeys,
  profEmailsKeys,
  useProfEmail,
  useProfEmails,
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
  updatedAt?: string | null;
};

const statuses: EmailStatus[] = [
  "DRAFT",
  "SENT",
  "REPLIED",
  "NO_REPLY",
  "NOT_INTERESTED",
];

export default function EmailsPage() {
  const qc = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Cached, deduped, focus-revalidated reads. Mutations below invalidate
  // the relevant query keys instead of re-running per-page `load()` helpers.
  const profEmailsQuery = useProfEmails();
  const schoolsQueryRaw = useSchools();
  const connectorsQuery = useConnectors();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const rows: EmailRow[] = useMemo(
    () => (profEmailsQuery.data ?? []) as EmailRow[],
    [profEmailsQuery.data],
  );
  const selectedDetailQuery = useProfEmail(selectedId);
  const loading = profEmailsQuery.isLoading;

  const [drafting, setDrafting] = useState<string | null>(null);
  const [profileUrlInput, setProfileUrlInput] = useState("");
  const [working, setWorking] = useState(false);
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
  const [draftSubject, setDraftSubject] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [saveVersionOpen, setSaveVersionOpen] = useState(false);
  const [saveVersionLabel, setSaveVersionLabel] = useState("");
  const [savingVersion, setSavingVersion] = useState(false);

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
  const [statusFilter, setStatusFilter] = useState<"ALL" | EmailStatus>("ALL");
  const [createDraftOpen, setCreateDraftOpen] = useState(false);
  const [createDraftTab, setCreateDraftTab] = useState<"url" | "schools">("schools");
  const [detailTab, setDetailTab] = useState<"profile" | "insights" | "publications">(
    "profile",
  );
  const [profEmailDraft, setProfEmailDraft] = useState("");
  const [auditLatestResearch, setAuditLatestResearch] = useState<
    Array<{ title: string; year: string | null; summary: string; evidence: string | null }>
  >([]);
  const [auditingResearch, setAuditingResearch] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);

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
    const detail = selectedDetailQuery.data as EmailRow | undefined;
    const row = rows.find((r) => r.id === selectedId);
    const current = detail?.id === selectedId ? detail : row;
    if (!current) return;
    setDraftSubject(current.emailSubject ?? "");
    setDraftBody(current.emailBody ?? "");
  }, [selectedId, rows, selectedDetailQuery.data]);

  useEffect(() => {
    if (!selectedId) return;
    const detail = selectedDetailQuery.data as EmailRow | undefined;
    const row = rows.find((r) => r.id === selectedId);
    const current = detail?.id === selectedId ? detail : row;
    setProfEmailDraft(current?.profEmail ?? "");
  }, [selectedId, rows, selectedDetailQuery.data]);

  useEffect(() => {
    setAuditLatestResearch([]);
    setAuditError(null);
    setDetailTab("profile");
  }, [selectedId]);

  const loadVersions = useCallback(async () => {
    await qc.invalidateQueries({
      queryKey: contentVersionsKeys.list("PROF_EMAIL", selectedId ?? ""),
    });
  }, [qc, selectedId]);

  // Connector status is supplied by `useConnectors()` above; no ad-hoc
  // useEffect required here.

  useEffect(() => {
    if (!selectedId) return;
    if (!rows.some((r) => r.id === selectedId)) {
      setSelectedId(null);
    }
  }, [rows, selectedId]);

  useEffect(() => {
    const qThread = searchParams.get("thread");
    if (!qThread) return;
    setSelectedId((prev) => (prev === qThread ? prev : qThread));
  }, [searchParams]);

  const selected = useMemo(() => {
    const fallback = rows.find((r) => r.id === selectedId) ?? null;
    const detail = selectedDetailQuery.data as EmailRow | undefined;
    return detail ?? fallback;
  }, [rows, selectedId, selectedDetailQuery.data]);
  const filteredRows = useMemo(() => {
    const q = threadQuery.trim().toLowerCase();
    return rows.filter((row) => {
      if (statusFilter !== "ALL" && row.status !== statusFilter) return false;
      if (!q) return true;
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
  }, [rows, threadQuery, statusFilter]);
  const existingProfessorEmails = useMemo(
    () =>
      new Set(
        rows
          .map((r) => (r.profEmail ?? "").trim().toLowerCase())
          .filter((email) => email.length > 0),
      ),
    [rows],
  );

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
      const res = await fetch(`/api/prof-emails/${id}/send-via-gmail`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attachmentDocumentIds: [] }),
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

  const addThreadFromDiscovery = async (c: DiscoveryCand) => {
    const normalizedEmail = (c.profEmail ?? "").trim().toLowerCase();
    if (normalizedEmail && existingProfessorEmails.has(normalizedEmail)) {
      alert("This professor email already exists in your thread list.");
      return;
    }
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
      await load();
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

  const runProfessorAudit = async (id: string) => {
    setAuditingResearch(true);
    setAuditError(null);
    try {
      const res = await fetch(`/api/prof-emails/${id}/audit`, {
        method: "POST",
      });
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        latestResearch?: Array<{
          title?: string;
          year?: string | null;
          summary?: string;
          evidence?: string | null;
        }>;
      };
      if (!res.ok) {
        setAuditLatestResearch([]);
        setAuditError(j.error ?? "Audit failed.");
        return;
      }
      const rows =
        Array.isArray(j.latestResearch) && j.latestResearch.length > 0
          ? j.latestResearch
              .map((r) => ({
                title: (r.title ?? "").trim(),
                year: r.year ?? null,
                summary: (r.summary ?? "").trim(),
                evidence: r.evidence ?? null,
              }))
              .filter((r) => r.title.length > 0)
          : [];
      setAuditLatestResearch(rows.slice(0, 3));
      setDetailTab("publications");
    } finally {
      setAuditingResearch(false);
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

      <div className="rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-2.5">
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={threadQuery}
              onChange={(e) => setThreadQuery(e.target.value)}
              placeholder="Search threads by professor, school, email, or research area"
              className="h-10 border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] pl-8 text-sm"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant={statusFilter === "ALL" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setStatusFilter("ALL")}
            >
              All ({rows.length})
            </Button>
            <Button
              type="button"
              variant={statusFilter === "DRAFT" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setStatusFilter("DRAFT")}
            >
              Draft ({rows.filter((r) => r.status === "DRAFT").length})
            </Button>
            <Button
              type="button"
              variant={statusFilter === "SENT" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setStatusFilter("SENT")}
            >
              Sent ({rows.filter((r) => r.status === "SENT").length})
            </Button>
            <Button
              type="button"
              variant={statusFilter === "REPLIED" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setStatusFilter("REPLIED")}
            >
              Replied ({rows.filter((r) => r.status === "REPLIED").length})
            </Button>
            <Button type="button" size="sm" onClick={() => setCreateDraftOpen(true)}>
              <Sparkles className="mr-1.5 h-4 w-4" aria-hidden />
              Add draft
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-8 xl:flex-row xl:items-start">
        {/* Manuscript workspace — left on xl */}
        <section className="order-2 min-w-0 flex-1 xl:order-1">
          {loading ? (
            <div className="scholar-manuscript text-sm text-muted-foreground">
              Loading…
            </div>
          ) : !selected ? (
            <div className="space-y-3">
              <div>
                <h2 className="font-display text-3xl font-semibold tracking-tight">Threads</h2>
                <p className="text-sm text-muted-foreground">
                  Select a draft to open the manuscript editor.
                </p>
              </div>
              {filteredRows.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-8 text-sm text-muted-foreground">
                  No threads match your filters yet.
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {filteredRows.map((row) => (
                    <div
                      key={row.id}
                      className="rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-4 transition hover:border-[var(--outline)] hover:bg-[var(--surface-container-lowest)]"
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedId(row.id);
                            router.replace(`/emails?thread=${encodeURIComponent(row.id)}`);
                          }}
                          className="min-w-0 flex-1 text-left"
                        >
                          <p className="line-clamp-1 font-semibold text-foreground">
                            {row.profName ?? "Professor"}
                          </p>
                        </button>
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className="text-[10px]">
                            {row.status.replaceAll("_", " ")}
                          </Badge>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            aria-label={`Delete ${row.profName ?? "thread"}`}
                            onClick={() => void remove(row.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedId(row.id);
                          router.replace(`/emails?thread=${encodeURIComponent(row.id)}`);
                        }}
                        className="w-full text-left"
                      >
                        <p className="line-clamp-1 text-sm text-muted-foreground">
                          {row.university ?? "University"}
                          {row.profEmail ? ` · ${row.profEmail}` : ""}
                        </p>
                        <p className="mt-2 line-clamp-2 text-sm text-foreground/90">
                          {row.emailSubject || "No subject yet"}
                        </p>
                        <p className="mt-2 line-clamp-1 text-xs text-muted-foreground">
                          {row.researchArea || "No research area"}
                        </p>
                      </button>
                    </div>
                  ))}
                </div>
              )}
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
                    <p className="mt-2 text-xs text-muted-foreground">
                      Tip: verify professor email + profile URL, then send from your own Gmail for
                      best deliverability.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      To send: Professor email, Gmail connection
                    </p>
                    <Button
                      type="button"
                      variant="link"
                      className="h-auto px-0 pt-1 text-xs text-muted-foreground"
                      onClick={() => {
                        setSelectedId(null);
                        router.replace("/emails");
                      }}
                    >
                      Back to threads
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="border-primary/40 text-primary">
                      {selected.status.replaceAll("_", " ")}
                    </Badge>
                    {googleOAuthConfigured && gmailConnected ? (
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => {
                          const missing: string[] = [];
                          if (!selected.profEmail?.trim() && !profEmailDraft.trim()) {
                            missing.push("Professor email");
                          }
                          if (!gmailConnected) missing.push("Gmail connection");
                          if (!draftSubject.trim()) missing.push("Subject line");
                          if (!draftBody.trim()) missing.push("Email body");
                          if (missing.length > 0) {
                            alert(`Complete these fields first:\n- ${missing.join("\n- ")}`);
                            return;
                          }
                          void sendViaGmail(selected.id);
                        }}
                      >
                        {sendingViaGmail ? "Sending…" : "Complete Required Fields"}
                      </Button>
                    ) : null}
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
                      {drafting === selected.id ? "Working…" : "Improve with AI"}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
                  <div className="w-full space-y-3 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-4">
                    <div>
                      <p className="text-sm font-medium text-foreground/90">Email draft</p>
                      <p className="text-xs text-muted-foreground">
                        Versioned content for this professor thread.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 border-[var(--outline-variant)] bg-[var(--surface-container-lowest)]"
                        onClick={() => {
                          if (!draftSubject.trim() && !draftBody.trim()) {
                            setDraftSubject(
                              `Prospective graduate applicant — research fit with ${selected.profName ?? "your lab"}`,
                            );
                            setDraftBody(
                              `Dear ${selected.profName ?? "Professor"},\n\nI hope you are doing well. I am applying to graduate programs and I am reaching out because your recent work aligns with my research interests.\n\nI would be grateful for a brief conversation about potential fit and ways I can contribute to your group.\n\nBest regards,`,
                            );
                          }
                        }}
                      >
                        Use template
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 border-[var(--outline-variant)] bg-[var(--surface-container-lowest)]"
                        disabled={drafting === selected.id}
                        onClick={() => aiDraft(selected.id)}
                      >
                        Personalize with AI
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 border-[var(--outline-variant)] bg-[var(--surface-container-lowest)]"
                        onClick={() => setDraftBody((prev) => prev.replace(/\s{2,}/g, " ").trim())}
                      >
                        Improve clarity
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 border-[var(--outline-variant)] bg-[var(--surface-container-lowest)]"
                        onClick={() =>
                          setDraftBody((prev) => {
                            const parts = prev
                              .split(/\n{2,}/)
                              .map((p) => p.trim())
                              .filter(Boolean);
                            return parts.length > 3 ? parts.slice(0, 3).join("\n\n") : prev;
                          })
                        }
                      >
                        Shorten
                      </Button>
                    </div>
                    <div className="space-y-2">
                      <Label>Subject line</Label>
                      <Input
                        className="border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] font-medium"
                        value={draftSubject}
                        onChange={(e) => setDraftSubject(e.target.value)}
                        onBlur={() => patch(selected.id, { emailSubject: draftSubject })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Email body</Label>
                      <Textarea
                        className="font-display min-h-[330px] resize-y border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] text-[15px] leading-relaxed text-foreground/95"
                        value={draftBody}
                        onChange={(e) => setDraftBody(e.target.value)}
                        onBlur={() => patch(selected.id, { emailBody: draftBody })}
                      />
                    </div>
                  </div>

                  <div className="w-full space-y-3 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-4 xl:w-[360px]">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full border-[var(--outline-variant)] bg-[var(--surface-container-lowest)]"
                      disabled={auditingResearch}
                      onClick={() => void runProfessorAudit(selected.id)}
                    >
                      <RefreshCw
                        className={cn(
                          "mr-2 h-4 w-4",
                          auditingResearch && "animate-spin",
                        )}
                        aria-hidden
                      />
                      {auditingResearch ? "Refreshing research…" : "Refresh research audit"}
                    </Button>
                    <div className="grid grid-cols-3 rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-1">
                      <button
                        type="button"
                        onClick={() => setDetailTab("profile")}
                        className={cn(
                          "h-8 rounded-md text-sm",
                          detailTab === "profile"
                            ? "bg-[var(--surface-container)] text-foreground"
                            : "text-muted-foreground",
                        )}
                      >
                        Profile
                      </button>
                      <button
                        type="button"
                        onClick={() => setDetailTab("insights")}
                        className={cn(
                          "h-8 rounded-md text-sm",
                          detailTab === "insights"
                            ? "bg-[var(--surface-container)] text-foreground"
                            : "text-muted-foreground",
                        )}
                      >
                        Insights
                      </button>
                      <button
                        type="button"
                        onClick={() => setDetailTab("publications")}
                        className={cn(
                          "h-8 rounded-md text-sm",
                          detailTab === "publications"
                            ? "bg-[var(--surface-container)] text-foreground"
                            : "text-muted-foreground",
                        )}
                      >
                        Publications
                      </button>
                    </div>
                    <div className="rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-4">
                      <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container)] text-lg font-semibold">
                        {(selected.profName ?? "P")
                          .split(" ")
                          .map((p) => p[0] ?? "")
                          .join("")
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>
                      <p className="text-center text-xl font-semibold">
                        {selected.profName ?? "Professor"}
                      </p>
                      <p className="text-center text-xs uppercase tracking-wide text-muted-foreground">
                        {selected.university ?? "Institution"}
                      </p>

                      {detailTab === "profile" ? (
                        <div className="mt-4 space-y-3">
                          <div className="space-y-2">
                            <Label>Professor email</Label>
                            <div className="flex gap-2">
                              <Input
                                value={profEmailDraft}
                                onChange={(e) => setProfEmailDraft(e.target.value)}
                                placeholder="name@university.edu"
                                type="email"
                                className="border-[var(--outline-variant)] bg-[var(--surface-container)]"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                className="border-[var(--outline-variant)]"
                                onClick={() =>
                                  patch(selected.id, {
                                    profEmail: profEmailDraft.trim() || null,
                                  })
                                }
                              >
                                Save
                              </Button>
                            </div>
                            {!profEmailDraft.trim() ? (
                              <p className="rounded-md border border-[var(--streak-orange)]/35 bg-[var(--streak-orange-soft)] px-2 py-1 text-xs text-[#7a3a08] dark:text-[var(--streak-orange)]">
                                Missing email.{" "}
                                {selected.profileUrl ? (
                                  <a
                                    href={selected.profileUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="underline"
                                  >
                                    Find Email
                                  </a>
                                ) : (
                                  "Find Email"
                                )}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      ) : detailTab === "insights" ? (
                        <div className="mt-4 rounded-md border border-[var(--outline-variant)] bg-[var(--surface-container)] p-3 text-sm text-muted-foreground">
                          {auditLatestResearch.length > 0
                            ? auditLatestResearch.map((r, i) => (
                                <p key={`${r.title}-${i}`} className={i > 0 ? "mt-2" : ""}>
                                  <span className="font-medium text-foreground/90">
                                    {r.year ? `${r.year} — ` : ""}
                                    {r.title}
                                  </span>
                                  {r.summary ? `: ${r.summary}` : ""}
                                </p>
                              ))
                            : selected.researchArea?.trim() ||
                              "Run research audit to generate professor-specific insights."}
                        </div>
                      ) : (
                        <div className="mt-4 space-y-2">
                          {auditError ? (
                            <p className="rounded-md border border-[var(--error)]/40 bg-[var(--error-container)] p-2 text-xs text-[var(--on-error-container)]">
                              {auditError}
                            </p>
                          ) : null}
                          {auditLatestResearch.length === 0 ? (
                            <p className="rounded-md border border-[var(--outline-variant)] bg-[var(--surface-container)] p-3 text-sm text-muted-foreground">
                              Run research audit to load the 3 latest research items.
                            </p>
                          ) : (
                            auditLatestResearch.map((r, idx) => (
                              <div
                                key={`${r.title}-${idx}`}
                                className="rounded-md border border-[var(--outline-variant)] bg-[var(--surface-container)] p-3"
                              >
                                <p className="text-sm font-semibold text-foreground/90">
                                  {r.title}
                                </p>
                                {r.year ? (
                                  <p className="text-xs text-muted-foreground">{r.year}</p>
                                ) : null}
                                {r.summary ? (
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    {r.summary}
                                  </p>
                                ) : null}
                                {r.evidence ? (
                                  <p className="mt-1 text-[11px] text-muted-foreground/85">
                                    Source: {r.evidence}
                                  </p>
                                ) : null}
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select
                      value={selected.status}
                      onValueChange={(v) => patch(selected.id, { status: v as EmailStatus })}
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
        <aside className="hidden">
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
                      const duplicateByEmail = Boolean(
                        c.profEmail?.trim() &&
                          existingProfessorEmails.has(c.profEmail.trim().toLowerCase()),
                      );
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
                            disabled={draftingDiscoverId === dk || duplicateByEmail}
                            title="Create thread only (no AI generation yet)"
                            onClick={() => void addThreadFromDiscovery(c)}
                          >
                            {draftingDiscoverId === dk ? (
                              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                            ) : (
                              <Sparkles className="h-4 w-4" aria-hidden />
                            )}
                            <span className="hidden sm:inline">
                              {duplicateByEmail ? "Already added" : "Add to thread"}
                            </span>
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

      <Dialog open={createDraftOpen} onOpenChange={setCreateDraftOpen}>
        <DialogContent className="max-w-3xl border-[var(--outline-variant)] bg-[var(--surface-container-lowest)]">
          <DialogHeader>
            <DialogTitle>Create outreach draft</DialogTitle>
            <DialogDescription>
              Pick one starting path. We&apos;ll guide you from discovery to a send-ready draft.
            </DialogDescription>
          </DialogHeader>
          <p className="rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-3 py-2 text-xs text-muted-foreground">
            Fastest path: use Professor URL when you already know who to contact. Use Schools +
            Profile to discover strong matches first.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setCreateDraftTab("url")}
              className={cn(
                "rounded-xl border p-3 text-left",
                createDraftTab === "url"
                  ? "border-primary/60 bg-primary/10 ring-1 ring-primary/30"
                  : "border-[var(--outline-variant)] bg-[var(--surface-container-low)]",
              )}
            >
              <p className="font-semibold">Professor URL</p>
              <p className="text-xs text-muted-foreground">Paste a faculty page and generate quickly.</p>
            </button>
            <button
              type="button"
              onClick={() => setCreateDraftTab("schools")}
              className={cn(
                "rounded-xl border p-3 text-left",
                createDraftTab === "schools"
                  ? "border-primary/60 bg-primary/10 ring-1 ring-primary/30"
                  : "border-[var(--outline-variant)] bg-[var(--surface-container-low)]",
              )}
            >
              <p className="font-semibold">Schools + Profile</p>
              <p className="text-xs text-muted-foreground">
                Get AI-ranked professor suggestions from your target schools.
              </p>
            </button>
          </div>

          {createDraftTab === "url" ? (
            <form className="space-y-3" onSubmit={analyzeFromUrl}>
              <div className="space-y-2">
                <Label htmlFor="faculty-url-modal">Professor profile or lab URL</Label>
                <Input
                  id="faculty-url-modal"
                  type="url"
                  inputMode="url"
                  placeholder="https://...faculty-page..."
                  value={profileUrlInput}
                  onChange={(e) => setProfileUrlInput(e.target.value)}
                  disabled={discovering || working}
                  className="border-[var(--outline-variant)] bg-[var(--surface-container-low)]"
                />
                <p className="text-xs text-muted-foreground">
                  Best sources: university faculty pages, lab pages, or Google Scholar profiles.
                </p>
              </div>
              <Button type="submit" className="w-full" disabled={analyzeUrlBlocked}>
                {working ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                    Analyzing…
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" aria-hidden />
                    Generate draft from URL
                  </>
                )}
              </Button>
            </form>
          ) : (
            <form className="space-y-3" onSubmit={discoverFacultyFromSchools}>
              <div className="flex items-center justify-between">
                <Label>Schools (from your tracker)</Label>
                <span className="text-xs text-muted-foreground">
                  {selectedSchoolIds.length} selected
                </span>
              </div>
              <div className="max-h-[220px] space-y-2 overflow-y-auto rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-3">
                {schools.map((s) => (
                  <label key={s.id} className="flex cursor-pointer items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4"
                      checked={selectedSchoolIds.includes(s.id)}
                      onChange={() => toggleSchool(s.id)}
                    />
                    <span>
                      <span className="font-medium">{s.name}</span>
                      <span className="text-muted-foreground">
                        {" "}
                        · {s.program} · {s.degree}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
              <Button type="submit" className="w-full" disabled={discoverSchoolsBlocked}>
                {discovering ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                    Suggesting…
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" aria-hidden />
                    Find best-match professors
                  </>
                )}
              </Button>
              {discoveryCandidates.length > 0 ? (
                <ul className="max-h-[180px] space-y-2 overflow-y-auto rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-2">
                  {discoveryCandidates.map((c, idx) => {
                    const dk = `${c.name}\0${c.profileUrl ?? ""}`;
                    const duplicateByEmail = Boolean(
                      c.profEmail?.trim() &&
                        existingProfessorEmails.has(c.profEmail.trim().toLowerCase()),
                    );
                    return (
                      <li
                        key={`${c.name}-${idx}`}
                        className="flex items-start justify-between gap-2 rounded-md border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-2"
                      >
                        <div className="min-w-0">
                          <p className="line-clamp-1 text-sm font-medium">{c.name}</p>
                          <p className="line-clamp-1 text-xs text-muted-foreground">
                            {c.targetSchoolLabel ?? "School"}
                          </p>
                          <p className="text-[11px] text-muted-foreground">Match {c.matchScore}/5</p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={draftingDiscoverId === dk || duplicateByEmail}
                          onClick={() => void addThreadFromDiscovery(c)}
                        >
                          {duplicateByEmail ? "Already added" : "Add to thread (draft)"}
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </form>
          )}
        </DialogContent>
      </Dialog>

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
