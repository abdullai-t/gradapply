"use client";

import { apiFetch } from "@/lib/api-fetch";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Icon } from "@/components/icon";
import { SealAvatar } from "@/components/seal-avatar";
import {
  DEGREE_OPTIONS,
  PROGRAM_OPTIONS,
  optionsWithFallback,
} from "@/lib/grad-options";
import { COUNTRY_OPTIONS } from "@/lib/country-options";
import { ADMISSION_TERM_OPTIONS } from "@/lib/admission-term";
import type { AdmissionTerm } from "@/types/enums";

const COUNTRY_SELECT_NONE = "__country_none__";
const TERM_SELECT_NONE = "__term_none__";

type SchoolStatus =
  | "PLANNING"
  | "APPLIED"
  | "WAITING"
  | "ACCEPTED"
  | "REJECTED"
  | "WITHDRAWN";

const statuses: SchoolStatus[] = [
  "PLANNING",
  "APPLIED",
  "WAITING",
  "ACCEPTED",
  "REJECTED",
  "WITHDRAWN",
];

const initialForm = {
  name: "",
  program: "",
  degree: "",
  country: "",
  term: "" as "" | AdmissionTerm,
  deadline: "",
  reminderAt: "",
  reminderNote: "",
  funding: "",
  notes: "",
  portalUrl: "",
  status: "PLANNING" as SchoolStatus,
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
};

type ProfileRecommendation = {
  name: string;
  program: string;
  degree: string;
  country: string;
  whyFit: string;
  notes: string;
  portalUrl: string;
};

export function AddSchoolModal({ open, onClose, onSaved }: Props) {
  const [mounted, setMounted] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [mode, setMode] = useState<"manual" | "profile">("profile");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recLoading, setRecLoading] = useState(false);
  const [recError, setRecError] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<ProfileRecommendation[]>(
    [],
  );
  const [recIndex, setRecIndex] = useState(0);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    setForm(initialForm);
    setAiError(null);
    setError(null);
    setAiLoading(false);
    setSaving(false);
    setMode("profile");
    setRecLoading(false);
    setRecError(null);
    setRecommendations([]);
    setRecIndex(0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const countryChoices = useMemo(
    () => optionsWithFallback(COUNTRY_OPTIONS, form.country),
    [form.country],
  );
  const canSubmit =
    form.name.trim().length > 0 &&
    form.program.trim().length > 0 &&
    form.degree.trim().length > 0 &&
    !saving;
  const currentRec = recommendations[recIndex] ?? null;

  const suggestFromAi = useCallback(async () => {
    const name = form.name.trim();
    if (!name) {
      setAiError("Enter a school or university name first.");
      return;
    }
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await apiFetch("/api/schools/infer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          ...(form.term ? { term: form.term } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : "Could not suggest details",
        );
      }
      setForm((prev) => ({
        ...prev,
        name,
        program: typeof data.program === "string" ? data.program : prev.program,
        degree: typeof data.degree === "string" ? data.degree : prev.degree,
        country: typeof data.country === "string" ? data.country : prev.country,
        deadline:
          typeof data.deadline === "string" ? data.deadline : prev.deadline,
        funding: typeof data.funding === "string" ? data.funding : prev.funding,
        notes: typeof data.notes === "string" ? data.notes : prev.notes,
        portalUrl:
          typeof data.portalUrl === "string" ? data.portalUrl : prev.portalUrl,
      }));
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "Suggest failed");
    } finally {
      setAiLoading(false);
    }
  }, [form.name, form.term]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.program.trim() || !form.degree.trim()) {
      setError("Select a program and degree.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch("/api/schools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          program: form.program,
          degree: form.degree,
          country: form.country || null,
          term: form.term ? form.term : null,
          deadline: form.deadline ? form.deadline : null,
          reminderAt: form.reminderAt ? form.reminderAt : null,
          reminderNote: form.reminderNote?.trim() ? form.reminderNote : null,
          funding: form.funding || null,
          notes: form.notes || null,
          portalUrl: form.portalUrl || null,
          status: form.status,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(
          typeof j.error === "object"
            ? JSON.stringify(j.error)
            : j.error ?? res.statusText,
        );
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const loadRecommendations = useCallback(async () => {
    setRecLoading(true);
    setRecError(null);
    try {
      const res = await apiFetch("/api/schools/recommend", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : "Could not generate recommendations",
        );
      }
      const rows = Array.isArray(data.schools)
        ? (data.schools as ProfileRecommendation[])
        : [];
      setRecommendations(rows);
      setRecIndex(0);
      if (rows.length === 0) {
        setRecError(
          "No recommendations right now. Update your profile and try again.",
        );
      }
    } catch (e) {
      setRecError(
        e instanceof Error ? e.message : "Failed to load recommendations",
      );
    } finally {
      setRecLoading(false);
    }
  }, []);

  const skipRecommendation = useCallback(() => {
    setRecIndex((i) => i + 1);
  }, []);

  const addRecommendationToList = useCallback(async () => {
    if (!currentRec) return;
    setSaving(true);
    setRecError(null);
    try {
      const res = await apiFetch("/api/schools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: currentRec.name,
          program: currentRec.program,
          degree: currentRec.degree,
          country: currentRec.country || null,
          notes: [currentRec.whyFit, currentRec.notes]
            .filter(Boolean)
            .join("\n\n"),
          portalUrl: currentRec.portalUrl || null,
          status: "PLANNING",
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(
          typeof j.error === "object"
            ? JSON.stringify(j.error)
            : j.error ?? "Could not add school",
        );
      }
      onSaved();
      setRecIndex((i) => i + 1);
    } catch (e) {
      setRecError(e instanceof Error ? e.message : "Failed to add school");
    } finally {
      setSaving(false);
    }
  }, [currentRec, onSaved]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--inverse-surface)]/40 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="tactile-card max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-3xl border-2 border-[var(--outline-variant)] p-0"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-school-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-6 py-5">
          <div className="flex items-start gap-3">
            <div
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white"
              style={{
                background:
                  "linear-gradient(135deg, var(--primary-container), var(--primary))",
              }}
            >
              <Icon name="add_business" size={22} />
            </div>
            <div>
              <h2
                id="add-school-title"
                className="m-0 text-lg font-bold tracking-tight text-[var(--on-surface)]"
              >
                Add school
              </h2>
              <p className="m-0 mt-0.5 text-sm text-[var(--on-surface-variant)]">
                Generate from your profile or fill in the details manually.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[var(--outline)] transition-colors hover:bg-[var(--surface-container)] hover:text-[var(--on-surface)]"
            onClick={onClose}
            aria-label="Close"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[calc(92vh-9rem)] overflow-y-auto px-6 py-5">
          <Tabs
            value={mode}
            onValueChange={(v) => setMode(v as "manual" | "profile")}
            className="space-y-5"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="profile">
                <Icon name="auto_awesome" size={16} />
                From profile (swipe)
              </TabsTrigger>
              <TabsTrigger value="manual">
                <Icon name="edit" size={16} />
                Manual
              </TabsTrigger>
            </TabsList>

            {/* MANUAL TAB */}
            <TabsContent value="manual">
              <form
                id="add-school-form"
                className="space-y-5"
                onSubmit={submit}
              >
                {error ? (
                  <div className="glass-alert-error" role="alert">
                    {error}
                  </div>
                ) : null}

                {/* Section: Basics */}
                <ModalSection
                  title="Basics"
                  description="School name, term, and program details. Fields marked * are required."
                  icon="info"
                >
                  <div className="space-y-2">
                    <Label
                      htmlFor="modal-school-name"
                      className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--outline)]"
                    >
                      School name *
                    </Label>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
                      <Input
                        id="modal-school-name"
                        required
                        value={form.name}
                        onChange={(e) =>
                          setForm({ ...form, name: e.target.value })
                        }
                        placeholder="e.g. Carnegie Mellon University"
                        className="sm:flex-1"
                        disabled={aiLoading || saving}
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        className="shrink-0 sm:w-auto"
                        disabled={aiLoading || saving || !form.name.trim()}
                        loading={aiLoading}
                        icon={aiLoading ? undefined : "auto_awesome"}
                        onClick={() => void suggestFromAi()}
                      >
                        Suggest details
                      </Button>
                    </div>
                    {aiError ? (
                      <p
                        className="text-sm text-[var(--error)]"
                        role="alert"
                      >
                        {aiError}
                      </p>
                    ) : null}
                    <p className="text-xs text-[var(--outline)]">
                      Pick an admission term before &quot;Suggest details&quot;
                      so deadlines match Fall / Spring / Summer intake.
                    </p>
                  </div>

                  <ModalField
                    htmlFor="modal-term"
                    label="Admission term"
                  >
                    <Select
                      value={form.term ? form.term : TERM_SELECT_NONE}
                      onValueChange={(v) =>
                        setForm({
                          ...form,
                          term:
                            v === TERM_SELECT_NONE
                              ? ""
                              : (v as AdmissionTerm),
                        })
                      }
                      disabled={saving || aiLoading}
                    >
                      <SelectTrigger id="modal-term">
                        <SelectValue placeholder="Term (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={TERM_SELECT_NONE}>
                          Not specified
                        </SelectItem>
                        {ADMISSION_TERM_OPTIONS.map(({ value, label }) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </ModalField>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <ModalField htmlFor="modal-program" label="Program *">
                      <Select
                        value={form.program || undefined}
                        onValueChange={(v) =>
                          setForm({ ...form, program: v })
                        }
                        disabled={saving}
                      >
                        <SelectTrigger id="modal-program">
                          <SelectValue placeholder="Select program" />
                        </SelectTrigger>
                        <SelectContent>
                          {PROGRAM_OPTIONS.map((p) => (
                            <SelectItem key={p} value={p}>
                              {p}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </ModalField>

                    <ModalField htmlFor="modal-degree" label="Degree *">
                      <Select
                        value={form.degree || undefined}
                        onValueChange={(v) =>
                          setForm({ ...form, degree: v })
                        }
                        disabled={saving}
                      >
                        <SelectTrigger id="modal-degree">
                          <SelectValue placeholder="Select degree" />
                        </SelectTrigger>
                        <SelectContent>
                          {DEGREE_OPTIONS.map((d) => (
                            <SelectItem key={d} value={d}>
                              {d}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </ModalField>

                    <ModalField htmlFor="modal-country" label="Country">
                      <Select
                        value={form.country ? form.country : COUNTRY_SELECT_NONE}
                        onValueChange={(v) =>
                          setForm({
                            ...form,
                            country: v === COUNTRY_SELECT_NONE ? "" : v,
                          })
                        }
                        disabled={saving}
                      >
                        <SelectTrigger id="modal-country">
                          <SelectValue placeholder="Country (optional)" />
                        </SelectTrigger>
                        <SelectContent className="max-h-[min(22rem,60vh)]">
                          <SelectItem value={COUNTRY_SELECT_NONE}>
                            Not specified
                          </SelectItem>
                          {countryChoices.map((c) => (
                            <SelectItem key={c} value={c}>
                              {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </ModalField>

                    <ModalField label="Status">
                      <Select
                        value={form.status}
                        onValueChange={(v) =>
                          setForm({ ...form, status: v as SchoolStatus })
                        }
                        disabled={saving}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          {statuses.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s.replaceAll("_", " ")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </ModalField>
                  </div>
                </ModalSection>

                {/* Section: Deadlines & reminders */}
                <ModalSection
                  title="Deadlines &amp; reminders"
                  description="Add timeline context now, or come back and fill later."
                  icon="event"
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <ModalField
                      htmlFor="modal-deadline"
                      label="Deadline"
                    >
                      <Input
                        id="modal-deadline"
                        type="date"
                        value={form.deadline}
                        onChange={(e) =>
                          setForm({ ...form, deadline: e.target.value })
                        }
                        disabled={saving}
                      />
                    </ModalField>
                    <ModalField
                      htmlFor="modal-reminder-at"
                      label="Remind me on"
                    >
                      <Input
                        id="modal-reminder-at"
                        type="date"
                        value={form.reminderAt}
                        onChange={(e) =>
                          setForm({ ...form, reminderAt: e.target.value })
                        }
                        disabled={saving}
                      />
                    </ModalField>
                  </div>
                  <ModalField
                    htmlFor="modal-reminder-note"
                    label="Reminder note"
                  >
                    <Input
                      id="modal-reminder-note"
                      placeholder="e.g. Submit fee waiver before deadline"
                      value={form.reminderNote}
                      onChange={(e) =>
                        setForm({ ...form, reminderNote: e.target.value })
                      }
                      disabled={saving}
                    />
                  </ModalField>
                </ModalSection>

                {/* Section: Additional details */}
                <ModalSection
                  title="Additional details"
                  description="Optional metadata to keep your tracker complete."
                  icon="more_horiz"
                >
                  <ModalField htmlFor="modal-funding" label="Funding notes">
                    <Input
                      id="modal-funding"
                      value={form.funding}
                      onChange={(e) =>
                        setForm({ ...form, funding: e.target.value })
                      }
                      disabled={saving}
                      placeholder="e.g. RA/TA preference, scholarship notes"
                    />
                  </ModalField>
                  <ModalField htmlFor="modal-portal" label="Portal URL">
                    <Input
                      id="modal-portal"
                      placeholder="https://..."
                      value={form.portalUrl}
                      onChange={(e) =>
                        setForm({ ...form, portalUrl: e.target.value })
                      }
                      disabled={saving}
                    />
                  </ModalField>
                  <ModalField htmlFor="modal-notes" label="Notes">
                    <Textarea
                      id="modal-notes"
                      value={form.notes}
                      onChange={(e) =>
                        setForm({ ...form, notes: e.target.value })
                      }
                      disabled={saving}
                      placeholder="Anything you want to remember for this school"
                    />
                  </ModalField>
                </ModalSection>
              </form>
            </TabsContent>

            {/* PROFILE / SWIPE TAB */}
            <TabsContent value="profile" className="space-y-5">
              <div className="rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="m-0 text-sm font-bold text-[var(--on-surface)]">
                      Profile-based suggestions
                    </p>
                    <p className="m-0 mt-1 text-xs leading-relaxed text-[var(--on-surface-variant)]">
                      Generate schools from your profile, then swipe right
                      (add) or left (skip). Added schools land in your
                      planning list to work on later.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void loadRecommendations()}
                    disabled={recLoading || saving}
                    loading={recLoading}
                    icon={recLoading ? undefined : "auto_awesome"}
                  >
                    {recommendations.length > 0
                      ? "Refresh"
                      : "Generate"}
                  </Button>
                </div>
                {recError ? (
                  <div className="glass-alert-error mt-3" role="alert">
                    {recError}
                  </div>
                ) : null}
              </div>

              {currentRec ? (
                <div className="tactile-card rounded-3xl border-2 border-[var(--outline-variant)] p-6">
                  <div className="mb-4 flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <SealAvatar name={currentRec.name} size={64} />
                      <div>
                        <div className="t-label-lg">
                          Card {recIndex + 1} of {recommendations.length}
                        </div>
                        <h3 className="m-0 text-xl font-bold leading-tight tracking-tight text-[var(--on-surface)]">
                          {currentRec.name}
                        </h3>
                        <p className="m-0 mt-0.5 text-sm text-[var(--on-surface-variant)]">
                          {currentRec.program} · {currentRec.degree}
                          {currentRec.country
                            ? ` · ${currentRec.country}`
                            : ""}
                        </p>
                      </div>
                    </div>
                  </div>

                  <p className="m-0 text-sm leading-relaxed text-[var(--on-surface)]">
                    {currentRec.whyFit}
                  </p>
                  {currentRec.notes ? (
                    <p className="m-0 mt-3 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-3 text-xs leading-relaxed text-[var(--on-surface-variant)]">
                      {currentRec.notes}
                    </p>
                  ) : null}
                  {currentRec.portalUrl ? (
                    <a
                      href={currentRec.portalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[var(--primary)] underline-offset-4 hover:underline"
                    >
                      View admissions page
                      <Icon name="open_in_new" size={12} />
                    </a>
                  ) : null}

                  <div className="mt-5 flex flex-wrap gap-3 border-t border-[var(--outline-variant)] pt-5">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={skipRecommendation}
                      disabled={saving}
                      icon="swipe_left"
                    >
                      Skip
                    </Button>
                    <Button
                      type="button"
                      onClick={() => void addRecommendationToList()}
                      disabled={saving}
                      loading={saving}
                      iconRight="swipe_right"
                    >
                      {saving ? "Adding…" : "Add to my list"}
                    </Button>
                  </div>
                </div>
              ) : recommendations.length > 0 && !recLoading ? (
                <div className="rounded-2xl border-2 border-dashed border-[var(--outline-variant)] p-8 text-center">
                  <Icon
                    name="celebration"
                    size={32}
                    className="text-[var(--secondary)]"
                  />
                  <p className="mt-3 text-sm font-bold text-[var(--on-surface)]">
                    You reviewed all suggestions.
                  </p>
                  <p className="mt-1 text-xs text-[var(--on-surface-variant)]">
                    Refresh to get another batch.
                  </p>
                </div>
              ) : null}
            </TabsContent>
          </Tabs>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-6 py-4">
          <p className="m-0 text-xs text-[var(--on-surface-variant)]">
            {mode === "manual"
              ? "Required: school name, program, degree."
              : "Profile mode: review cards and add schools to your planning list."}
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            {mode === "manual" ? (
              <Button
                type="submit"
                form="add-school-form"
                disabled={!canSubmit}
                loading={saving}
                icon={saving ? undefined : "save"}
              >
                {saving ? "Saving…" : "Save school"}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ModalSection({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-5">
      <header className="mb-4 flex items-start gap-2.5">
        <div
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg"
          style={{
            background: "rgba(0,98,157,0.08)",
            color: "var(--primary)",
          }}
        >
          <Icon name={icon} size={18} />
        </div>
        <div>
          <p
            className="m-0 text-sm font-bold text-[var(--on-surface)]"
            dangerouslySetInnerHTML={{ __html: title }}
          />
          <p className="m-0 mt-0.5 text-xs text-[var(--on-surface-variant)]">
            {description}
          </p>
        </div>
      </header>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function ModalField({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label
        htmlFor={htmlFor}
        className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--outline)]"
      >
        {label}
      </Label>
      {children}
    </div>
  );
}
