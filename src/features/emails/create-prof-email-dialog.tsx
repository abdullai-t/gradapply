"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { messageFromApiErrorPayload } from "@/lib/api-error-json";
import { cn } from "@/lib/utils";
import { useSchools } from "@/features/schools/api";
import { profEmailsKeys } from "@/features/emails/api";
import { useQueryClient } from "@tanstack/react-query";

import type { DiscoveryCand, EmailRow, SchoolPick } from "./types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingProfessorEmails: Set<string>;
  onCreated: (row: EmailRow) => void;
};

export function CreateProfEmailDialog({
  open,
  onOpenChange,
  existingProfessorEmails,
  onCreated,
}: Props) {
  const qc = useQueryClient();
  const schoolsQuery = useSchools();

  const [createDraftTab, setCreateDraftTab] = useState<"url" | "schools">("schools");
  const [profileUrlInput, setProfileUrlInput] = useState("");
  const [analyzeProfName, setAnalyzeProfName] = useState("");
  const [analyzeUniversity, setAnalyzeUniversity] = useState("");
  const [working, setWorking] = useState(false);
  const [selectedSchoolIds, setSelectedSchoolIds] = useState<string[]>([]);
  const [discoveryCandidates, setDiscoveryCandidates] = useState<DiscoveryCand[]>(
    [],
  );
  const [discovering, setDiscovering] = useState(false);
  const [draftingDiscoverId, setDraftingDiscoverId] = useState<string | null>(null);

  const schools: SchoolPick[] = useMemo(() => {
    const list = (schoolsQuery.data ?? []) as Array<{
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
  }, [schoolsQuery.data]);

  const resetForm = useCallback(() => {
    setProfileUrlInput("");
    setAnalyzeProfName("");
    setAnalyzeUniversity("");
    setSelectedSchoolIds([]);
    setDiscoveryCandidates([]);
    setCreateDraftTab("schools");
    setDiscovering(false);
    setWorking(false);
    setDraftingDiscoverId(null);
  }, []);

  const close = useCallback(() => {
    resetForm();
    onOpenChange(false);
  }, [onOpenChange, resetForm]);

  const invalidateList = () =>
    void qc.invalidateQueries({ queryKey: profEmailsKeys.all });

  const toggleSchool = (id: string) => {
    setSelectedSchoolIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const analyzeFromUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = profileUrlInput.trim();
    if (!url) return;
    setWorking(true);
    try {
      const name = analyzeProfName.trim();
      const university = analyzeUniversity.trim();
      const res = await fetch("/api/prof-emails/from-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileUrl: url,
          ...(name && university ? { profName: name, university } : {}),
        }),
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
      await invalidateList();
      close();
      onCreated(created);
    } finally {
      setWorking(false);
    }
  };

  const discoverFacultyFromSchools = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedSchoolIds.length === 0) {
      alert("Select at least one school.");
      return;
    }
    setDiscovering(true);
    setDiscoveryCandidates([]);
    try {
      const res = await fetch("/api/prof-emails/discover-by-schools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schoolIds: selectedSchoolIds }),
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
      setDiscoveryCandidates(
        Array.isArray(data.candidates)
          ? (data.candidates as DiscoveryCand[])
          : [],
      );
    } finally {
      setDiscovering(false);
    }
  };

  const addFromDiscovery = async (c: DiscoveryCand) => {
    const normalizedEmail = (c.profEmail ?? "").trim().toLowerCase();
    if (normalizedEmail && existingProfessorEmails.has(normalizedEmail)) {
      alert("This professor email already exists in your drafts.");
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
          matchScore: c.matchScore,
        }),
      });
      const payload = await create.json().catch(() => ({}));
      if (!create.ok) {
        alert(messageFromApiErrorPayload(payload));
        return;
      }
      await invalidateList();
    } finally {
      setDraftingDiscoverId(null);
    }
  };

  const discoverBlocked = discovering || working || selectedSchoolIds.length === 0;
  const analyzeUrlBlocked = working || !profileUrlInput.trim();

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) onOpenChange(true);
        else close();
      }}
    >
      <DialogContent className="max-w-3xl border-[var(--outline-variant)] bg-[var(--surface-container-lowest)]">
        <DialogHeader>
          <DialogTitle>Create outreach draft</DialogTitle>
          <DialogDescription>
            Pick one starting path. We&apos;ll guide you from discovery to a send-ready draft.
          </DialogDescription>
        </DialogHeader>
        <p className="rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-3 py-2 text-xs text-muted-foreground">
          Fastest path: use Professor URL when you already know who to contact. Use Schools +
          Profile to discover strong matches first. Verify every name on the official directory
          before sending.
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
            <p className="text-xs text-muted-foreground">
              Paste a faculty page and generate quickly.
            </p>
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
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="analyze-prof-name-modal">Professor name (optional)</Label>
                <Input
                  id="analyze-prof-name-modal"
                  value={analyzeProfName}
                  onChange={(e) => setAnalyzeProfName(e.target.value)}
                  placeholder="e.g. Jane Smith"
                  disabled={discovering || working}
                  className="border-[var(--outline-variant)] bg-[var(--surface-container-low)]"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="analyze-university-modal">University (optional)</Label>
                <Input
                  id="analyze-university-modal"
                  value={analyzeUniversity}
                  onChange={(e) => setAnalyzeUniversity(e.target.value)}
                  placeholder="e.g. Stanford University"
                  disabled={discovering || working}
                  className="border-[var(--outline-variant)] bg-[var(--surface-container-low)]"
                />
              </div>
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
              {schools.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No schools yet.{" "}
                  <Link href="/schools" className="text-primary underline-offset-4 hover:underline">
                    Add schools
                  </Link>{" "}
                  first.
                </p>
              ) : (
                schools.map((s) => (
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
                ))
              )}
            </div>
            <Button type="submit" className="w-full" disabled={discoverBlocked}>
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
                        <p className="text-[11px] text-muted-foreground">
                          Match {c.matchScore}/5
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={draftingDiscoverId === dk || duplicateByEmail}
                        onClick={() => void addFromDiscovery(c)}
                      >
                        {duplicateByEmail ? "Already added" : "Add draft"}
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
  );
}
