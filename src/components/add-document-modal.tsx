"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Icon } from "@/components/icon";

const kinds = ["cv", "transcript", "gre", "sop_draft", "other"] as const;

export const DOCUMENT_KIND_LABEL: Record<(typeof kinds)[number], string> = {
  cv: "CV",
  transcript: "Transcript",
  gre: "GRE",
  sop_draft: "Statement of purpose",
  other: "Other",
};

const KIND_ICON: Record<(typeof kinds)[number], string> = {
  cv: "description",
  transcript: "school",
  gre: "calculate",
  sop_draft: "edit_note",
  other: "draft",
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
};

function uploadFormDataWithProgress(
  formData: FormData,
  onProgress: (percent: number) => void,
): Promise<{ ok: boolean; status: number; bodyText: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/documents/upload");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) {
        onProgress(Math.min(100, Math.round((100 * e.loaded) / e.total)));
      }
    };
    xhr.onload = () => {
      resolve({
        ok: xhr.status >= 200 && xhr.status < 300,
        status: xhr.status,
        bodyText: xhr.responseText ?? "",
      });
    };
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.send(formData);
  });
}

export function AddDocumentModal({ open, onClose, onSaved }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [kind, setKind] = useState<(typeof kinds)[number]>("other");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setFile(null);
    setKind("other");
    setUploading(false);
    setProgress(0);
    setError(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Choose a file to upload.");
      return;
    }
    setUploading(true);
    setError(null);
    setProgress(0);

    const form = new FormData();
    form.append("file", file);
    form.append("kind", kind);

    try {
      const res = await uploadFormDataWithProgress(form, setProgress);
      let message = "Upload failed";
      try {
        const j = JSON.parse(res.bodyText || "{}") as { error?: string };
        if (typeof j.error === "string") message = j.error;
      } catch {
        /* ignore */
      }
      if (!res.ok) {
        setError(message);
        setUploading(false);
        setProgress(0);
        return;
      }
      setProgress(100);
      onSaved();
      onClose();
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--inverse-surface)]/40 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="tactile-card max-h-[90vh] w-full max-w-lg overflow-hidden rounded-3xl border-2 border-[var(--outline-variant)] p-0"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-doc-title"
        onMouseDown={(ev) => ev.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-6 py-5">
          <div className="flex items-start gap-3">
            <div
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
              style={{
                background: "rgba(0,98,157,0.08)",
                color: "var(--primary)",
              }}
            >
              <Icon name="cloud_upload" size={22} />
            </div>
            <div>
              <h2
                id="add-doc-title"
                className="m-0 text-lg font-bold tracking-tight text-[var(--on-surface)]"
              >
                Upload document
              </h2>
              <p className="m-0 mt-0.5 text-sm text-[var(--on-surface-variant)]">
                Add a file to your library so the assistant can use it as
                context.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[var(--outline)] transition-colors hover:bg-[var(--surface-container)] hover:text-[var(--on-surface)] disabled:opacity-40"
            onClick={onClose}
            disabled={uploading}
            aria-label="Close"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={submit} className="space-y-5 px-6 py-6">
          {error ? (
            <p className="glass-alert-error" role="alert">
              {error}
            </p>
          ) : null}

          {/* Drop-zone styled file input */}
          <div className="space-y-2">
            <Label
              htmlFor="modal-doc-file"
              className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--outline)]"
            >
              File
            </Label>
            <label
              htmlFor="modal-doc-file"
              className={`group flex cursor-pointer items-center justify-between gap-4 rounded-2xl border-2 border-dashed border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-5 py-5 transition-all hover:border-[var(--primary-container)] hover:bg-[var(--primary-fixed)]/30 ${
                uploading ? "pointer-events-none opacity-60" : ""
              }`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <div
                  className="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-[var(--outline)] transition-colors group-hover:bg-[var(--primary-container)]/15 group-hover:text-[var(--primary)]"
                  style={{ background: "var(--surface-container)" }}
                >
                  <Icon name="upload_file" size={26} />
                </div>
                <div className="min-w-0">
                  <div className="truncate font-bold text-[var(--on-surface)]">
                    {file?.name ?? "Choose a file…"}
                  </div>
                  <div className="text-xs text-[var(--on-surface-variant)]">
                    {file
                      ? humanSize(file.size)
                      : "Drag-and-drop or click to browse."}
                  </div>
                </div>
              </div>
              {file ? (
                <span className="rounded-full border border-[var(--primary-container)]/30 bg-[var(--primary-fixed)] px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.08em] text-[var(--primary)]">
                  Replace
                </span>
              ) : (
                <span className="rounded-full border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.08em] text-[var(--on-surface-variant)]">
                  Browse
                </span>
              )}
              <Input
                id="modal-doc-file"
                type="file"
                disabled={uploading}
                className="sr-only"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>

          {/* Document type */}
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--outline)]">
              Document type
            </Label>
            <Select
              value={kind}
              onValueChange={(v) => setKind(v as (typeof kinds)[number])}
              disabled={uploading}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {kinds.map((k) => (
                  <SelectItem key={k} value={k}>
                    <span className="inline-flex items-center gap-2">
                      <Icon name={KIND_ICON[k]} size={16} />
                      {DOCUMENT_KIND_LABEL[k]}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Progress */}
          {uploading ? (
            <div className="space-y-2 rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-4 py-3">
              <div className="flex items-center justify-between text-xs text-[var(--on-surface-variant)]">
                <span className="inline-flex items-center gap-2">
                  <Icon
                    name="progress_activity"
                    className="animate-spin"
                    size={14}
                  />
                  Uploading…
                </span>
                <span className="font-bold text-[var(--primary)]">
                  {progress}%
                </span>
              </div>
              <Progress value={progress} tone="primary" size="default" />
              <p className="text-[11px] text-[var(--outline)]">
                Sending to storage — keep this tab open until complete.
              </p>
            </div>
          ) : null}

          {/* Actions */}
          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              disabled={uploading}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={uploading || !file}
              loading={uploading}
              icon={uploading ? undefined : "cloud_upload"}
            >
              {uploading ? "Uploading…" : "Upload"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
