"use client";

import { useCallback, useEffect, useState } from "react";
import { FileText, Loader2, Sparkles, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { messageFromApiErrorPayload } from "@/lib/api-error-json";

type DocRow = { id: string; name: string; type: string };

type VariantRow = {
  id: string;
  title: string;
  body: string;
  sourceMasterId: string | null;
  updatedAt: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schoolId: string;
  schoolName: string;
  onSaved?: () => void;
};

export function SopTailorDialog({
  open,
  onOpenChange,
  schoolId,
  schoolName,
  onSaved,
}: Props) {
  const [documents, setDocuments] = useState<DocRow[]>([]);
  const [variant, setVariant] = useState<VariantRow | null>(null);
  const [masterSource, setMasterSource] = useState<"library" | "paste">("paste");
  const [masterDocId, setMasterDocId] = useState<string>("");
  const [pasteText, setPasteText] = useState("");
  const [editedTitle, setEditedTitle] = useState("");
  const [editedBody, setEditedBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sopDrafts = documents.filter((d) => d.type === "sop_draft");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [docRes, varRes] = await Promise.all([
        fetch("/api/documents"),
        fetch(`/api/sop/variants?schoolId=${encodeURIComponent(schoolId)}`),
      ]);
      if (!docRes.ok) {
        const data = await docRes.json().catch(() => ({}));
        setError(
          `Could not load documents (${docRes.status}): ${messageFromApiErrorPayload(data)}`,
        );
        return;
      }
      if (!varRes.ok) {
        const data = await varRes.json().catch(() => ({}));
        setError(
          `Could not load tailored draft (${varRes.status}): ${messageFromApiErrorPayload(data)}`,
        );
        return;
      }
      setDocuments(await docRes.json());
      const data = (await varRes.json()) as { variant: VariantRow | null };
      setVariant(data.variant);
      if (data.variant) {
        setEditedTitle(data.variant.title);
        setEditedBody(data.variant.body);
      } else {
        setEditedTitle(`${schoolName} — tailored SOP`);
        setEditedBody("");
      }
    } catch {
      setError("Network error while loading this dialog.");
    } finally {
      setLoading(false);
    }
  }, [schoolId, schoolName]);

  useEffect(() => {
    if (!open || !schoolId.trim()) return;
    void load();
  }, [open, schoolId, load]);

  const generate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { schoolId };
      if (masterSource === "library") {
        if (!masterDocId)
          throw new Error("Choose a statement-of-purpose draft from your library.");
        body.masterDocumentId = masterDocId;
      } else {
        if (pasteText.trim().length < 80)
          throw new Error("Paste at least 80 characters of your master SOP.");
        body.masterText = pasteText.trim();
      }
      body.title = editedTitle.trim() || `${schoolName} — tailored SOP`;

      const res = await fetch("/api/sop/variants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(messageFromApiErrorPayload(data));
      }
      const v = data.variant as VariantRow;
      setVariant(v);
      setEditedTitle(v.title);
      setEditedBody(v.body);
      onSaved?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const saveEdits = async () => {
    if (!variant) {
      setError("Generate a tailored draft first.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/sop/variants/${variant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editedTitle.trim() || variant.title,
          body: editedBody,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(messageFromApiErrorPayload(data));
      }
      setVariant(data as VariantRow);
      onSaved?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-panel max-h-[min(92vh,920px)] max-w-[min(96rem,calc(100vw-1.5rem))] gap-0 overflow-hidden border-white/15 p-0 sm:rounded-2xl">
        <DialogHeader className="border-b border-white/10 px-6 py-4">
          <DialogTitle className="font-display text-xl">
            Tailor SOP for {schoolName}
          </DialogTitle>
          <DialogDescription className="text-left">
            Start from one master draft, then generate and edit a school-specific variant.
          </DialogDescription>
        </DialogHeader>

        <div className="border-b border-amber-500/25 bg-amber-500/[0.07] px-6 py-3 text-sm leading-relaxed text-muted-foreground">
          <strong className="font-medium text-amber-100">Factual claims:</strong>{" "}
          AI output can misstate programs or people. Verify every concrete claim (faculty,
          labs, courses, requirements) on official department pages before you submit.
          Undocumented faculty names are avoided unless they appear in your master draft or
          school notes.
        </div>

        <div className="max-h-[calc(min(92vh,920px)-13rem)] overflow-y-auto px-6 py-4">
          {error ? (
            <p className="mb-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Loading…
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-3 rounded-xl border border-white/10 bg-muted/20 p-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <FileText className="h-4 w-4 text-primary" aria-hidden />
                  Master source
                </div>
                <Select
                  value={masterSource}
                  onValueChange={(v) =>
                    setMasterSource(v as "library" | "paste")
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paste">Paste master SOP</SelectItem>
                    <SelectItem value="library">From Documents (SOP draft)</SelectItem>
                  </SelectContent>
                </Select>

                {masterSource === "library" ? (
                  <div className="space-y-2">
                    <Label>Library draft</Label>
                    <Select value={masterDocId} onValueChange={setMasterDocId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a file…" />
                      </SelectTrigger>
                      <SelectContent>
                        {sopDrafts.length === 0 ? (
                          <SelectItem value="__none__" disabled>
                            No SOP drafts — upload under Documents
                          </SelectItem>
                        ) : (
                          sopDrafts.map((d) => (
                            <SelectItem key={d.id} value={d.id}>
                              {d.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      PDF text is read server-side when you generate. Scanned PDFs may not
                      work — paste instead.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="sop-paste">Master SOP text</Label>
                    <Textarea
                      id="sop-paste"
                      value={pasteText}
                      onChange={(e) => setPasteText(e.target.value)}
                      placeholder="Paste your master statement of purpose…"
                      className="min-h-[180px] font-mono text-sm"
                    />
                  </div>
                )}

                <Button
                  type="button"
                  className="w-full gap-2"
                  disabled={
                    generating ||
                    (masterSource === "library" &&
                      (!masterDocId || sopDrafts.length === 0)) ||
                    (masterSource === "paste" && pasteText.trim().length < 80)
                  }
                  onClick={() => void generate()}
                >
                  {generating ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Sparkles className="h-4 w-4" aria-hidden />
                  )}
                  Generate tailored draft
                </Button>
              </div>

              <div className="space-y-3">
                <Tabs defaultValue="compare" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="compare">Master vs tailored</TabsTrigger>
                    <TabsTrigger value="edit">Edit variant</TabsTrigger>
                  </TabsList>
                  <TabsContent value="compare" className="mt-3 space-y-3">
                    <div className="grid max-h-[320px] gap-3 md:grid-cols-2">
                      <div className="flex min-h-0 flex-col rounded-lg border border-white/10 bg-black/20">
                        <div className="border-b border-white/10 px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Master
                        </div>
                        <div className="min-h-[220px] overflow-auto p-3 font-mono text-xs leading-relaxed text-muted-foreground">
                          {masterSource === "paste" ? (
                            <span className="whitespace-pre-wrap">
                              {pasteText.trim() || "—"}
                            </span>
                          ) : masterDocId ? (
                            <div className="space-y-2">
                              <div className="font-medium text-foreground">
                                {sopDrafts.find((d) => d.id === masterDocId)?.name ??
                                  "—"}
                              </div>
                              <p>
                                Full text is read from this file on the server when you
                                generate (selectable PDF or text works best).
                              </p>
                            </div>
                          ) : (
                            "Choose a library draft."
                          )}
                        </div>
                      </div>
                      <div className="flex min-h-0 flex-col rounded-lg border border-white/10 bg-black/20">
                        <div className="border-b border-white/10 px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Tailored
                        </div>
                        <div className="min-h-[220px] overflow-auto whitespace-pre-wrap p-3 font-mono text-xs leading-relaxed">
                          {editedBody.trim()
                            ? editedBody
                            : "Generate to see the tailored statement."}
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                  <TabsContent value="edit" className="mt-3 space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="variant-title">Variant title</Label>
                      <Input
                        id="variant-title"
                        value={editedTitle}
                        onChange={(e) => setEditedTitle(e.target.value)}
                        className="glass-input"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="variant-body">Tailored statement</Label>
                      <Textarea
                        id="variant-body"
                        value={editedBody}
                        onChange={(e) => setEditedBody(e.target.value)}
                        className="min-h-[280px] font-mono text-sm"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      className="gap-2"
                      disabled={saving || !variant}
                      onClick={() => void saveEdits()}
                    >
                      {saving ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      ) : (
                        <Save className="h-4 w-4" aria-hidden />
                      )}
                      Save edits
                    </Button>
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-white/10 px-6 py-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
