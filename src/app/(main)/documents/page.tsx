"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ExternalLink, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AddDocumentModal, DOCUMENT_KIND_LABEL } from "@/components/add-document-modal";
import { formatBytes } from "@/lib/utils";

type DocRow = {
  id: string;
  name: string;
  type: string;
  url: string;
  size: number | null;
  createdAt: string;
};

function kindLabel(raw: string): string {
  const k = raw as keyof typeof DOCUMENT_KIND_LABEL;
  return DOCUMENT_KIND_LABEL[k] ?? raw.replaceAll("_", " ");
}

export default function DocumentsPage() {
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [planTier, setPlanTier] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/documents");
    if (res.ok) setDocs(await res.json());
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    let active = true;
    void fetch("/api/billing/status", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) return null;
        return (await res.json()) as { planTier?: string };
      })
      .then((json) => {
        if (!active) return;
        setPlanTier(json?.planTier ?? null);
      })
      .catch(() => {
        if (!active) return;
        setPlanTier(null);
      });
    return () => {
      active = false;
    };
  }, []);

  const sorted = useMemo(
    () =>
      [...docs].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [docs],
  );

  const remove = async (id: string) => {
    if (!confirm("Remove this document from your library?")) return;
    const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
    if (res.ok) await load();
  };

  if (planTier === "FREE") {
    return (
      <Card className="glass-panel border-white/10">
        <CardHeader>
          <CardTitle className="font-display text-lg">Documents</CardTitle>
          <CardDescription>
            Documents are available on PLUS and PRO plans.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
            Upgrade your plan in Settings to access your document library.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-24">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Documents</h1>
        <p className="text-muted-foreground">
          Your library lists every file by type. Use the floating button to add a document
          and watch upload progress in the modal.
        </p>
      </div>

      <Card className="glass-panel border-white/10">
        <CardHeader>
          <CardTitle>Library</CardTitle>
          <CardDescription>
            Open files in a new tab or remove them — storage is deleted when Cloudinary or S3
            is configured.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading documents…</div>
          ) : sorted.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No documents yet — tap the add button to upload your first file.
            </div>
          ) : (
            sorted.map((doc) => (
              <div
                key={doc.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-white/10 bg-muted/30 px-4 py-4 shadow-sm backdrop-blur-sm"
              >
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-semibold">{doc.name}</span>
                    <Badge variant="secondary" className="font-normal shrink-0">
                      {kindLabel(doc.type)}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {doc.size != null ? formatBytes(doc.size) : "Unknown size"} · Added{" "}
                    {format(new Date(doc.createdAt), "MMM d, yyyy")}
                  </div>
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary underline-offset-4 hover:underline"
                  >
                    Open file
                    <ExternalLink className="h-3 w-3" aria-hidden />
                  </a>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  aria-label="Remove document"
                  onClick={() => remove(doc.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Button
        type="button"
        size="icon"
        className="fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full shadow-lg"
        aria-label="Add document"
        onClick={() => setAddOpen(true)}
      >
        <Plus className="h-7 w-7" aria-hidden />
      </Button>

      <AddDocumentModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSaved={() => void load()}
      />
    </div>
  );
}
