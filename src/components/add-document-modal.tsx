"use client";

import { useEffect, useState } from "react";
import { Loader2, Upload, X } from "lucide-react";
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

const kinds = ["cv", "transcript", "gre", "sop_draft", "other"] as const;

export const DOCUMENT_KIND_LABEL: Record<(typeof kinds)[number], string> = {
  cv: "CV",
  transcript: "Transcript",
  gre: "GRE",
  sop_draft: "Statement of purpose",
  other: "Other",
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
        aria-labelledby="add-doc-title"
        onMouseDown={(ev) => ev.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h2 id="add-doc-title" className="text-lg font-semibold">
            Upload document
          </h2>
          <button
            type="button"
            className="rounded-lg p-2 hover:bg-white/10 disabled:opacity-40"
            onClick={onClose}
            disabled={uploading}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-4 px-5 py-4">
          {error ? (
            <p
              className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="modal-doc-file">File</Label>
            <Input
              id="modal-doc-file"
              type="file"
              disabled={uploading}
              className="glass-input cursor-pointer file:mr-3 file:rounded-md file:border-0 file:bg-primary/15 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>

          <div className="space-y-2">
            <Label>Document type</Label>
            <Select
              value={kind}
              onValueChange={(v) => setKind(v as (typeof kinds)[number])}
              disabled={uploading}
            >
              <SelectTrigger className="glass-input">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {kinds.map((k) => (
                  <SelectItem key={k} value={k}>
                    {DOCUMENT_KIND_LABEL[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {uploading ? (
            <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  Uploading…
                </span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
              <p className="text-[11px] text-muted-foreground">
                Sending to Cloudinary — keep this tab open until complete.
              </p>
            </div>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <Button type="button" variant="outline" disabled={uploading} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={uploading || !file} className="gap-2">
              <Upload className="h-4 w-4" aria-hidden />
              Upload
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
