"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import {
  DEGREE_OPTIONS,
  PROGRAM_OPTIONS,
  optionsWithFallback,
} from "@/lib/grad-options";
import { COUNTRY_OPTIONS } from "@/lib/country-options";
import { ADMISSION_TERM_OPTIONS } from "@/lib/admission-term";
import type { AdmissionTerm } from "@prisma/client";

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

export function AddSchoolModal({ open, onClose, onSaved }: Props) {
  const [form, setForm] = useState(initialForm);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm(initialForm);
    setAiError(null);
    setError(null);
    setAiLoading(false);
    setSaving(false);
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

  const suggestFromAi = async () => {
    const name = form.name.trim();
    if (!name) {
      setAiError("Enter a school or university name first.");
      return;
    }
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch("/api/schools/infer", {
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
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.program.trim() || !form.degree.trim()) {
      setError("Select a program and degree.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/schools", {
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

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="glass-panel max-h-[90vh] w-full max-w-lg overflow-hidden rounded-2xl border shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-school-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h2 id="add-school-title" className="text-lg font-semibold">
            Add school
          </h2>
          <button
            type="button"
            className="rounded-lg p-2 hover:bg-white/10"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[calc(90vh-4.5rem)] overflow-y-auto px-5 py-4">
          <form className="grid gap-4 md:grid-cols-2" onSubmit={submit}>
            {error ? (
              <p
                className="md:col-span-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                role="alert"
              >
                {error}
              </p>
            ) : null}
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="modal-school-name">School name</Label>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
                <Input
                  id="modal-school-name"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Carnegie Mellon University"
                  className="sm:flex-1"
                  disabled={aiLoading || saving}
                />
                <Button
                  type="button"
                  variant="secondary"
                  className="shrink-0 gap-2 sm:w-auto"
                  disabled={aiLoading || saving || !form.name.trim()}
                  onClick={() => void suggestFromAi()}
                >
                  {aiLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Sparkles className="h-4 w-4" aria-hidden />
                  )}
                  Suggest details
                </Button>
              </div>
              {aiError ? (
                <p className="text-sm text-destructive" role="alert">
                  {aiError}
                </p>
              ) : null}
              <p className="text-xs text-muted-foreground">
                Pick an admission term before &quot;Suggest details&quot; so deadlines match
                Fall / Spring / Summer intake (optional).
              </p>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="modal-term">Admission term</Label>
              <Select
                value={form.term ? form.term : TERM_SELECT_NONE}
                onValueChange={(v) =>
                  setForm({
                    ...form,
                    term: v === TERM_SELECT_NONE ? "" : (v as AdmissionTerm),
                  })
                }
                disabled={saving || aiLoading}
              >
                <SelectTrigger id="modal-term">
                  <SelectValue placeholder="Term (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TERM_SELECT_NONE}>Not specified</SelectItem>
                  {ADMISSION_TERM_OPTIONS.map(({ value, label }) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="modal-program">Program</Label>
              <Select
                value={form.program || undefined}
                onValueChange={(v) => setForm({ ...form, program: v })}
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
            </div>
            <div className="space-y-2">
              <Label htmlFor="modal-degree">Degree</Label>
              <Select
                value={form.degree || undefined}
                onValueChange={(v) => setForm({ ...form, degree: v })}
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
            </div>
            <div className="space-y-2">
              <Label htmlFor="modal-country">Country</Label>
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
            </div>
            <div className="space-y-2">
              <Label htmlFor="modal-deadline">Deadline</Label>
              <Input
                id="modal-deadline"
                type="date"
                value={form.deadline}
                onChange={(e) =>
                  setForm({ ...form, deadline: e.target.value })
                }
                disabled={saving}
                className="glass-input min-h-11"
              />
            </div>
            <div className="space-y-2 md:col-span-2 rounded-lg border border-white/10 bg-white/[0.02] p-3">
              <p className="text-xs font-medium text-muted-foreground">
                Reminder (optional)
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="modal-reminder-at">Remind me on</Label>
                  <Input
                    id="modal-reminder-at"
                    type="date"
                    value={form.reminderAt}
                    onChange={(e) =>
                      setForm({ ...form, reminderAt: e.target.value })
                    }
                    disabled={saving}
                    className="glass-input min-h-11"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="modal-reminder-note">Reminder note</Label>
                  <Input
                    id="modal-reminder-note"
                    placeholder="Short note"
                    value={form.reminderNote}
                    onChange={(e) =>
                      setForm({ ...form, reminderNote: e.target.value })
                    }
                    disabled={saving}
                  />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
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
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="modal-funding">Funding notes</Label>
              <Input
                id="modal-funding"
                value={form.funding}
                onChange={(e) =>
                  setForm({ ...form, funding: e.target.value })
                }
                disabled={saving}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="modal-portal">Portal URL</Label>
              <Input
                id="modal-portal"
                placeholder="https://..."
                value={form.portalUrl}
                onChange={(e) =>
                  setForm({ ...form, portalUrl: e.target.value })
                }
                disabled={saving}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="modal-notes">Notes</Label>
              <Textarea
                id="modal-notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                disabled={saving}
              />
            </div>
            <div className="flex flex-wrap justify-end gap-2 md:col-span-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  saving || !form.program.trim() || !form.degree.trim()
                }
              >
                {saving ? "Saving…" : "Save school"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
