"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { PageLoader } from "@/components/page-loader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { log } from "@/lib/logger";
import { useQueryClient } from "@tanstack/react-query";

import {
  contentVersionsKeys,
  profEmailsKeys,
  useDeleteProfEmail,
  useProfEmail,
  useProfEmails,
} from "@/features/emails/api";
import { isMutationPendingForId } from "@/lib/mutation-pending";
import { useConnectors } from "@/features/connectors/api";
import { profEmailsIndexPath } from "@/features/emails/paths";
import type { EmailRow } from "@/features/emails/types";
import { GoogleDocsLinkButton } from "@/features/google-docs/google-docs-link-button";

import {
  EmailDraftEditor,
  OutreachTrackingCard,
  ProfEmailBreadcrumb,
  ProfEmailHero,
  ResearchContextPanel,
} from "./prof-email-detail-sections";
type Props = {
  emailId: string;
};

export function ProfEmailDetailPage({ emailId }: Props) {
  const qc = useQueryClient();
  const router = useRouter();

  const profEmailsQuery = useProfEmails();
  const deleteProfEmail = useDeleteProfEmail();
  const connectorsQuery = useConnectors();
  const selectedId = emailId;

  const rows: EmailRow[] = useMemo(
    () => (profEmailsQuery.data ?? []) as EmailRow[],
    [profEmailsQuery.data],
  );
  const selectedDetailQuery = useProfEmail(selectedId);
  const selected = useMemo(() => {
    const fallback = rows.find((r) => r.id === selectedId) ?? null;
    const detail = selectedDetailQuery.data as EmailRow | undefined;
    return detail ?? fallback;
  }, [rows, selectedId, selectedDetailQuery.data]);
  const loading = profEmailsQuery.isLoading;

  const [drafting, setDrafting] = useState<string | null>(null);
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

  const [detailTab, setDetailTab] = useState<"profile" | "insights" | "publications">(
    "profile",
  );
  const [profEmailDraft, setProfEmailDraft] = useState("");
  const [auditLatestResearch, setAuditLatestResearch] = useState<
    Array<{ title: string; year: string | null; summary: string; evidence: string | null }>
  >([]);
  const [auditingResearch, setAuditingResearch] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);

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
    setAuditError(null);
    setDetailTab("profile");
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) {
      setAuditLatestResearch([]);
      return;
    }
    if (!selected || selected.id !== selectedId) {
      setAuditLatestResearch([]);
      return;
    }
    const ra = selected.researchAudit;
    if (ra?.latestResearch && Array.isArray(ra.latestResearch)) {
      setAuditLatestResearch(
        ra.latestResearch
          .map((r) => ({
            title: (r.title ?? "").trim(),
            year: r.year ?? null,
            summary: (r.summary ?? "").trim(),
            evidence: r.evidence ?? null,
          }))
          .filter((r) => r.title.length > 0)
          .slice(0, 3),
      );
      return;
    }
    setAuditLatestResearch([]);
  }, [selectedId, selected]);

  const loadVersions = useCallback(async () => {
    await qc.invalidateQueries({
      queryKey: contentVersionsKeys.list("PROF_EMAIL", selectedId ?? ""),
    });
  }, [qc, selectedId]);

  // Connector status is supplied by `useConnectors()` above; no ad-hoc
  // useEffect required here.

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
    await deleteProfEmail.mutateAsync(id);
    router.push(profEmailsIndexPath());
  };

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
          "Regeneration failed. Add a profile URL or set OPENROUTER_API_KEY or GROQ_API_KEY.",
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
        const errMsg = j.error ?? "Audit failed.";
        log.warn("prof-emails/audit.client-failed", {
          profEmailId: id,
          status: res.status,
          error: typeof errMsg === "string" ? errMsg : String(errMsg),
        });
        setAuditError(errMsg);
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
      setAuditError(null);
      setDetailTab("publications");
      await qc.invalidateQueries({ queryKey: profEmailsKeys.detail(id) });
      await qc.invalidateQueries({ queryKey: profEmailsKeys.list() });
    } finally {
      setAuditingResearch(false);
    }
  };

  const handleSendGmail = () => {
    if (!selected) return;
    const missing: string[] = [];
    if (!selected.profEmail?.trim() && !profEmailDraft.trim()) {
      missing.push("Professor email");
    }
    if (!draftSubject.trim()) missing.push("Subject line");
    if (!draftBody.trim()) missing.push("Email body");
    if (missing.length > 0) {
      alert(`Complete these fields first:\n- ${missing.join("\n- ")}`);
      return;
    }
    void sendViaGmail(selected.id);
  };

  const detailLoading =
    selectedDetailQuery.isLoading && selectedDetailQuery.data == null;

  if (loading || detailLoading) {
    return <PageLoader label="Loading draft…" />;
  }

  if (!selected) {
    return (
      <div className="slide-in space-y-10 pb-10">
        <div className="tactile-card rounded-3xl border border-[var(--outline-variant)] p-10 text-center">
          <h1 className="t-headline-md text-[var(--on-surface)]">Draft not found</h1>
          <p className="mt-2 text-sm text-[var(--on-surface-variant)]">
            This professor outreach may have been deleted or the link is invalid.
          </p>
          <Button className="mt-6" asChild>
            <Link href={profEmailsIndexPath()}>Back to professor drafts</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="slide-in mx-auto max-w-[1380px] space-y-10 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ProfEmailBreadcrumb profName={selected.profName} />
        <div className="flex flex-wrap items-center gap-2">
          <GoogleDocsLinkButton
            entityType="PROF_EMAIL"
            entityId={selected.id}
          />
        </div>
      </div>

      <ProfEmailHero
        selected={selected}
        gmailConnected={gmailConnected}
        googleOAuthConfigured={googleOAuthConfigured}
        sendingViaGmail={sendingViaGmail}
        drafting={drafting === selected.id}
        deleting={isMutationPendingForId(deleteProfEmail, selected.id)}
        onSendGmail={handleSendGmail}
        onAiDraft={() => aiDraft(selected.id)}
        onDelete={() => void remove(selected.id)}
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <EmailDraftEditor
          selected={selected}
          draftSubject={draftSubject}
          draftBody={draftBody}
          drafting={drafting === selected.id}
          onSubjectChange={setDraftSubject}
          onBodyChange={setDraftBody}
          onSubjectBlur={() => patch(selected.id, { emailSubject: draftSubject })}
          onBodyBlur={() => patch(selected.id, { emailBody: draftBody })}
          onTemplate={() => {
            if (!draftSubject.trim() && !draftBody.trim()) {
              setDraftSubject(
                `Prospective graduate applicant — research fit with ${selected.profName ?? "your lab"}`,
              );
              setDraftBody(
                `Dear ${selected.profName ?? "Professor"},\n\nI hope you are doing well. I am applying to graduate programs and I am reaching out because your recent work aligns with my research interests.\n\nI would be grateful for a brief conversation about potential fit and ways I can contribute to your group.\n\nBest regards,`,
              );
            }
          }}
          onAiDraft={() => aiDraft(selected.id)}
          onClarity={() => setDraftBody((prev) => prev.replace(/\s{2,}/g, " ").trim())}
          onShorten={() =>
            setDraftBody((prev) => {
              const parts = prev
                .split(/\n{2,}/)
                .map((p) => p.trim())
                .filter(Boolean);
              return parts.length > 3 ? parts.slice(0, 3).join("\n\n") : prev;
            })
          }
          onSaveVersion={() => setSaveVersionOpen(true)}
        />

        <aside className="space-y-6">
          <ResearchContextPanel
            selected={selected}
            detailTab={detailTab}
            onTabChange={setDetailTab}
            profEmailDraft={profEmailDraft}
            onProfEmailChange={setProfEmailDraft}
            onSaveEmail={() =>
              patch(selected.id, { profEmail: profEmailDraft.trim() || null })
            }
            auditLatestResearch={auditLatestResearch}
            auditError={auditError}
            auditingResearch={auditingResearch}
            onRunAudit={() => void runProfessorAudit(selected.id)}
          />
          <OutreachTrackingCard
            status={selected.status}
            notes={selected.notes}
            onStatusChange={(v) => patch(selected.id, { status: v })}
            onNotesBlur={(notes) => patch(selected.id, { notes })}
          />
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
