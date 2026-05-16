"use client";

import type { EmailStatus, ProfEmail } from "@prisma/client";
import { useEffect, useState } from "react";
import { X } from "lucide-react";

const statuses: EmailStatus[] = [
  "DRAFT",
  "SENT",
  "REPLIED",
  "NO_REPLY",
];

type Props = {
  open: boolean;
  onClose: () => void;
  editing: ProfEmail | null;
  onSaved: () => void;
};

export function AddEmailModal({ open, onClose, editing, onSaved }: Props) {
  const [professorName, setProfessorName] = useState("");
  const [professorEmail, setProfessorEmail] = useState("");
  const [university, setUniversity] = useState("");
  const [profileUrl, setProfileUrl] = useState("");
  const [researchArea, setResearchArea] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [status, setStatus] = useState<EmailStatus>("DRAFT");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editing) {
      setProfessorName(editing.profName ?? "");
      setProfessorEmail(editing.profEmail ?? "");
      setUniversity(editing.university ?? "");
      setProfileUrl(editing.profileUrl ?? "");
      setResearchArea(editing.researchArea ?? "");
      setEmailSubject(editing.emailSubject ?? "");
      setEmailBody(editing.emailBody ?? "");
      setStatus(editing.status);
      setNotes(editing.notes ?? "");
    } else {
      setProfessorName("");
      setProfessorEmail("");
      setUniversity("");
      setProfileUrl("");
      setResearchArea("");
      setEmailSubject("");
      setEmailBody("");
      setStatus("DRAFT");
      setNotes("");
    }
    setError(null);
  }, [editing, open]);

  if (!open) return null;

  async function generateWithAI() {
    if (!professorName.trim() || !university.trim() || !researchArea.trim()) {
      setError("Fill in professor name, university, and research area first.");
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const prompt = `Write a cold email to Prof ${professorName.trim()} at ${university.trim()} who works on ${researchArea.trim()}. Use my profile context from the assistant; align their recent or representative work with my research interests and reference it briefly if that context supports it—do not invent papers. Produce only the email body text (plain text, no subject line).`;
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "email",
          message: prompt,
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        let msg = errText;
        try {
          const j = JSON.parse(errText) as { error?: unknown };
          if (typeof j.error === "string") msg = j.error;
        } catch {
          /* use raw */
        }
        throw new Error(msg || "Request failed");
      }
      const data = (await res.json()) as { reply?: string; error?: string };
      if (data.error) throw new Error(data.error);
      setEmailBody(data.reply ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        professorName,
        professorEmail,
        university,
        profileUrl: profileUrl.trim() || null,
        researchArea,
        emailSubject,
        emailBody,
        status,
        notes: notes || null,
      };
      const res = await fetch(
        editing ? `/api/emails/${editing.id}` : "/api/emails",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(typeof j.error === "string" ? j.error : res.statusText);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <h2 className="text-lg font-semibold">
            {editing ? "Edit email" : "Draft professor email"}
          </h2>
          <button
            type="button"
            className="rounded-lg p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-4 px-6 py-4">
          {error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
              {error}
            </p>
          ) : null}

          <Field label="Professor name">
            <input
              required
              value={professorName}
              onChange={(e) => setProfessorName(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
            />
          </Field>
          <Field label="Professor email">
            <input
              type="email"
              required
              value={professorEmail}
              onChange={(e) => setProfessorEmail(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
            />
          </Field>
          <Field label="University">
            <input
              required
              value={university}
              onChange={(e) => setUniversity(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
            />
          </Field>
          <Field label="Faculty profile URL (optional)">
            <input
              type="url"
              value={profileUrl}
              onChange={(e) => setProfileUrl(e.target.value)}
              placeholder="https://…"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
            />
          </Field>
          <Field label="Research area / interests">
            <input
              required
              value={researchArea}
              onChange={(e) => setResearchArea(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
            />
          </Field>
          <Field label="Email subject">
            <input
              required
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
            />
          </Field>
          <div className="flex items-center justify-between gap-2">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Email body
            </label>
            <button
              type="button"
              disabled={generating}
              title="Uses your configured LLM (OpenRouter or Groq)"
              className="text-xs font-medium text-violet-700 hover:underline disabled:opacity-50 dark:text-violet-400"
              onClick={() => void generateWithAI()}
            >
              {generating ? "Generating…" : "Generate with AI"}
            </button>
          </div>
          <textarea
            required
            value={emailBody}
            onChange={(e) => setEmailBody(e.target.value)}
            rows={12}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
          />
          <Field label="Status">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as EmailStatus)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
            >
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {s.replace("_", " ").toLowerCase()}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Notes">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
            />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : editing ? "Save" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-zinc-700 dark:text-zinc-300">
        {label}
      </span>
      {children}
    </label>
  );
}
