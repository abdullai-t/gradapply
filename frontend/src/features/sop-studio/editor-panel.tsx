"use client";

import { useEffect, useRef, useState } from "react";

import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import type { SopScoreResponse } from "@/server/sop-score/schemas";

import {
  SUGGESTION_RESOLVED_EVENT,
  type SuggestionResolvedDetail,
} from "./ai-suggestion-node";
import {
  paragraphsToHtml,
  splitParagraphs,
  type SopVariantRow,
  useRewriteDocument,
  useRewriteSelection,
  useScoreSop,
  useUpdateVariant,
} from "./api";
import { DocumentReview } from "./document-review";
import { StudioToast, type ToastSpec } from "./toast";
import {
  type SopEditorHandle,
  SopTiptapEditor,
} from "./tiptap-editor";

type Props = {
  schoolId: string;
  schoolName: string;
  schoolProgram?: string | null;
  schoolDegree?: string | null;
  schoolCountry?: string | null;
  variant: SopVariantRow;
  /// Triggers a refinement message in the chat panel — same path as if the
  /// user typed it manually.
  onAskAI: (prompt: string) => void;
  /// Brief flash highlight used after an AI rewrite lands.
  flash: boolean;
};

const DEFAULT_SCORE: SopScoreResponse = {
  persuasiveness: 0,
  clarity: 0,
  tone: [
    { label: "Academic", active: false },
    { label: "Ambitious", active: false },
    { label: "Structured", active: false },
    { label: "Personal", active: false },
  ],
  checklist: [
    { label: "Academic goals stated", done: false },
    { label: "Research background", done: false },
    { label: "Why this school? (specifics)", done: false },
    { label: "Career objectives", done: false },
  ],
};

const SAVE_DEBOUNCE_MS = 1200;
const SCORE_DEBOUNCE_MS = 2500;
const SCORE_MIN_CHARS = 200;

export function SopEditorPanel({
  schoolId,
  schoolName,
  schoolProgram,
  schoolDegree,
  schoolCountry,
  variant,
  onAskAI,
  flash,
}: Props) {
  const editorRef = useRef<SopEditorHandle>(null);
  const [draftHtml, setDraftHtml] = useState(variant.body);
  const [draftText, setDraftText] = useState(() => htmlToText(variant.body));
  const [showMaster, setShowMaster] = useState(false);
  const [score, setScore] = useState<SopScoreResponse>(DEFAULT_SCORE);

  const updateVariant = useUpdateVariant(schoolId);
  const scoreMutation = useScoreSop(schoolId);
  const rewriteMutation = useRewriteSelection();
  const docRewriteMutation = useRewriteDocument();

  // Whole-document rewrite review state. When set, the editor is hidden
  // and the DocumentReview overlay is shown instead.
  const [pendingRewrite, setPendingRewrite] = useState<{
    prompt: string;
    oldParagraphs: string[];
    newParagraphs: string[];
  } | null>(null);
  const [docRewriteError, setDocRewriteError] = useState<string | null>(null);
  // Pre-fill the bottom-bar prompt when the user clicks "Try again".
  const [retrySeed, setRetrySeed] = useState<string>("");
  const [toast, setToast] = useState<ToastSpec | null>(null);

  // Listen for selection-accept events from any pending suggestion node.
  // Reject does not fire — original text is restored, nothing to undo.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<SuggestionResolvedDetail>).detail;
      if (detail?.state !== "accepted") return;
      setToast({
        id: `accept-selection-${Date.now()}`,
        message: "Suggestion accepted",
        undo: () => editorRef.current?.undo(),
      });
    };
    window.addEventListener(SUGGESTION_RESOLVED_EVENT, handler);
    return () =>
      window.removeEventListener(SUGGESTION_RESOLVED_EVENT, handler);
  }, []);

  const onRewriteSelection = async (input: {
    selectionText: string;
    prompt: string;
  }) =>
    rewriteMutation.mutateAsync({
      originalText: input.selectionText,
      prompt: input.prompt,
      schoolId,
      scope: "selection",
    });

  const beginDocRewrite = async (prompt: string) => {
    setDocRewriteError(null);
    const oldParagraphs = splitParagraphs(htmlToText(draftHtml));
    if (oldParagraphs.length === 0) {
      setDocRewriteError("Draft is empty.");
      return;
    }
    try {
      const res = await docRewriteMutation.mutateAsync({
        originalText: oldParagraphs.join("\n\n"),
        prompt,
        schoolId,
      });
      if (res.unchanged) {
        setDocRewriteError(
          "AI returned the same draft — try a more specific instruction.",
        );
        return;
      }
      const newParagraphs = splitParagraphs(res.newText);
      if (newParagraphs.length === 0) {
        setDocRewriteError(
          "AI didn't return any text. Try rephrasing your prompt.",
        );
        return;
      }
      setPendingRewrite({ prompt, oldParagraphs, newParagraphs });
      setRetrySeed("");
    } catch (e) {
      setDocRewriteError(e instanceof Error ? e.message : "Rewrite failed");
    }
  };

  const acceptDocRewrite = (finalParagraphs: string[]) => {
    // Snapshot the pre-accept body BEFORE we replace it — Tiptap's
    // setContent may bypass undo history for whole-doc swaps, so we keep
    // our own copy and restore from it on the toast's Undo.
    const previousHtml = editorRef.current?.getHtml() ?? draftHtml;
    const newHtml = paragraphsToHtml(finalParagraphs);
    setDraftHtml(newHtml);
    setDraftText(htmlToText(newHtml));
    editorRef.current?.setHtml(newHtml);
    // Auto-save kicks in via the existing debounce on draftHtml. We also
    // fire an immediate PATCH so a hard reload right after Accept loses
    // nothing, even if the user clicks before debounce expires.
    updateVariant.mutate({ id: variant.id, body: newHtml });
    setPendingRewrite(null);
    setToast({
      id: `accept-doc-${Date.now()}`,
      message: "Draft updated",
      undo: () => {
        editorRef.current?.setHtml(previousHtml);
        setDraftHtml(previousHtml);
        setDraftText(htmlToText(previousHtml));
        updateVariant.mutate({ id: variant.id, body: previousHtml });
      },
    });
  };

  const rejectDocRewrite = () => setPendingRewrite(null);

  const retryDocRewrite = (prompt: string) => {
    setPendingRewrite(null);
    setRetrySeed(prompt);
  };

  // Block hard-reload / tab close while a review is pending so the user
  // doesn't lose the AI draft they were in the middle of evaluating.
  // Soft Next.js navigations (in-app Links) bypass beforeunload — we
  // accept that limitation; if the user clicks "Exit studio" we'll lose
  // the pending review (intentional, since they explicitly chose to leave).
  useEffect(() => {
    if (!pendingRewrite) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // The custom string is ignored by modern browsers; presence of
      // returnValue is what triggers the native confirm dialog.
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [pendingRewrite]);

  // When the parent loads a new variant (initial mount or AI rewrite), push
  // it into the editor without nuking cursor state on every keystroke.
  useEffect(() => {
    setDraftHtml(variant.body);
    setDraftText(htmlToText(variant.body));
    editorRef.current?.setHtml(variant.body);
  }, [variant.id, variant.body]);

  // Debounced save of manual edits.
  useEffect(() => {
    if (!draftHtml || draftHtml === variant.body) return;
    const t = setTimeout(() => {
      updateVariant.mutate({ id: variant.id, body: draftHtml });
    }, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(t);
    // We intentionally exclude `updateVariant` and `variant.body` from deps
    // to avoid re-firing the save on the server-confirmed body echo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftHtml, variant.id]);

  // Debounced LLM scoring for the sidebar.
  useEffect(() => {
    if (draftText.length < SCORE_MIN_CHARS) return;
    const t = setTimeout(() => {
      scoreMutation.mutate(draftText, {
        onSuccess: (data) => setScore(data),
      });
    }, SCORE_DEBOUNCE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftText, schoolId]);

  const dirty = draftHtml !== variant.body;
  const saving = updateVariant.isPending;

  return (
    <section className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      {/* Editor + bottom AI bar */}
      <div className="flex flex-col overflow-hidden rounded-3xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] shadow-sm">
        {pendingRewrite ? (
          <div className="p-3">
            <DocumentReview
              oldParagraphs={pendingRewrite.oldParagraphs}
              newParagraphs={pendingRewrite.newParagraphs}
              prompt={pendingRewrite.prompt}
              onAccept={acceptDocRewrite}
              onReject={rejectDocRewrite}
              onRetry={retryDocRewrite}
            />
          </div>
        ) : showMaster && variant.masterText ? (
          <div className="grid grid-cols-2 gap-0">
            <div className="border-r border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[var(--outline)]">
                  Master · your original
                </div>
                <button
                  type="button"
                  onClick={() => setShowMaster(false)}
                  aria-label="Hide master"
                  className="grid h-7 w-7 place-items-center rounded-lg text-[var(--outline)] hover:bg-[var(--surface-container)] hover:text-[var(--on-surface)]"
                >
                  <Icon name="close" size={16} />
                </button>
              </div>
              <div className="max-h-[600px] overflow-auto whitespace-pre-wrap font-mono text-[12px] leading-relaxed text-[var(--on-surface-variant)]">
                {variant.masterText}
              </div>
            </div>
            <div>
              <SopTiptapEditor
                ref={editorRef}
                initialHtml={draftHtml}
                onChange={(html, text) => {
                  setDraftHtml(html);
                  setDraftText(text);
                }}
                flash={flash}
                onRewriteSelection={onRewriteSelection}
              />
            </div>
          </div>
        ) : (
          <div className="relative">
            {variant.masterText ? (
              <button
                type="button"
                onClick={() => setShowMaster(true)}
                className="absolute right-3 top-2 z-10 inline-flex items-center gap-1 rounded-full border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-2.5 py-1 text-[11px] font-bold text-[var(--on-surface-variant)] shadow-sm hover:border-[var(--primary)] hover:text-[var(--on-surface)]"
              >
                <Icon name="visibility" size={12} />
                View original
              </button>
            ) : null}
            <SopTiptapEditor
              ref={editorRef}
              initialHtml={draftHtml}
              onChange={(html, text) => {
                setDraftHtml(html);
                setDraftText(text);
              }}
              flash={flash}
              onRewriteSelection={onRewriteSelection}
            />
          </div>
        )}

        {/* Bottom AI prompt bar — triggers a whole-document rewrite review.
            Discussion lives in the Chat tab, intentionally separate. */}
        <BottomAskBar
          onSubmit={beginDocRewrite}
          busy={docRewriteMutation.isPending}
          disabled={pendingRewrite !== null}
          error={docRewriteError}
          seed={retrySeed}
          onSeedConsumed={() => setRetrySeed("")}
        />
      </div>

      {/* Sidebar */}
      <aside className="flex flex-col gap-4">
        <SidebarCard>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="t-title-md m-0 text-[var(--on-surface)]">
              Writing insights
            </h3>
            <Icon
              name={scoreMutation.isPending ? "progress_activity" : "trending_up"}
              size={18}
              className={`text-[var(--primary)] ${scoreMutation.isPending ? "animate-spin" : ""}`}
            />
          </div>
          {draftText.length < SCORE_MIN_CHARS ? (
            <p className="m-0 text-xs text-[var(--on-surface-variant)]">
              Insights appear once your draft is at least {SCORE_MIN_CHARS}{" "}
              characters.
            </p>
          ) : (
            <>
              <Metric
                label="Persuasiveness"
                value={score.persuasiveness}
                color="var(--primary)"
              />
              <Metric label="Clarity" value={score.clarity} color="#1aa37e" />
              <div className="mt-4 mb-2 text-xs font-extrabold uppercase tracking-[0.08em] text-[var(--outline)]">
                Tone analysis
              </div>
              <div className="flex flex-wrap gap-1.5">
                {score.tone.map((t) => (
                  <TonePill key={t.label} active={t.active}>
                    {t.label}
                  </TonePill>
                ))}
              </div>
            </>
          )}
        </SidebarCard>

        <SidebarCard>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="t-title-md m-0 text-[var(--on-surface)]">Checklist</h3>
            <Icon name="task_alt" size={18} className="text-[var(--primary)]" />
          </div>
          <ul className="space-y-2">
            {score.checklist.map((c) => (
              <ChecklistItem
                key={c.label}
                done={c.done}
                onAskAI={
                  c.done
                    ? undefined
                    : () =>
                        onAskAI(
                          `Help me address this checklist item: "${c.label}". Suggest a paragraph for the draft.`,
                        )
                }
              >
                {c.label}
              </ChecklistItem>
            ))}
          </ul>
        </SidebarCard>

        <SidebarCard padded={false}>
          <div className="relative h-32 overflow-hidden rounded-t-2xl bg-gradient-to-br from-slate-700 to-slate-900">
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
            <div className="absolute bottom-3 left-3 right-3">
              <div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-white/80">
                Target
              </div>
              <div className="truncate text-base font-bold text-white">
                {schoolName}
              </div>
            </div>
          </div>
          <div className="p-4 text-xs text-[var(--on-surface-variant)]">
            {[schoolProgram, schoolDegree, schoolCountry]
              .filter(Boolean)
              .join(" · ") || "Targeted school"}
          </div>
        </SidebarCard>

        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold">
            {dirty ? (
              <span className="inline-flex items-center gap-1 text-[var(--outline)]">
                <Icon name="edit" size={14} />
                Unsaved
              </span>
            ) : saving ? (
              <span className="inline-flex items-center gap-1 text-[var(--on-surface-variant)]">
                <Icon name="progress_activity" size={14} className="animate-spin" />
                Saving…
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[var(--primary)]">
                <Icon name="check_circle" size={14} fill />
                Saved
              </span>
            )}
          </span>
          <Button
            size="sm"
            icon="save"
            onClick={() =>
              updateVariant.mutate({ id: variant.id, body: draftHtml })
            }
            disabled={saving || !dirty}
          >
            Save now
          </Button>
        </div>
      </aside>

      <StudioToast toast={toast} onDismiss={() => setToast(null)} />
    </section>
  );
}

function BottomAskBar({
  onSubmit,
  busy,
  disabled,
  error,
  seed,
  onSeedConsumed,
}: {
  onSubmit: (text: string) => void | Promise<void>;
  busy?: boolean;
  disabled?: boolean;
  error?: string | null;
  /// When non-empty, hydrate the input. The parent clears it via
  /// `onSeedConsumed` to avoid re-applying the seed on every render.
  seed?: string;
  onSeedConsumed?: () => void;
}) {
  const [text, setText] = useState("");

  useEffect(() => {
    if (seed && !text) {
      setText(seed);
      onSeedConsumed?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed]);

  const inert = busy || disabled;

  const submit = () => {
    const value = text.trim();
    if (!value || inert) return;
    void onSubmit(value);
    setText("");
  };

  return (
    <div className="border-t border-[var(--outline-variant)] bg-gradient-to-b from-[var(--surface-container-lowest)] to-[var(--surface-container-low)] p-3">
      <div
        className={`flex items-center gap-2 rounded-full border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 py-1.5 shadow-sm transition-all focus-within:border-[var(--primary)] focus-within:shadow-[0_0_0_4px_color-mix(in_srgb,var(--primary)_12%,transparent)] ${
          inert ? "opacity-60" : ""
        }`}
      >
        <Icon name="auto_fix_high" size={18} className="shrink-0 text-[var(--primary)]" />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={
            disabled
              ? "Resolve the pending rewrite first…"
              : busy
                ? "Drafting your rewrite…"
                : "Rewrite the draft (e.g. ‘cut to 650 words’ or ‘sound less academic’)…"
          }
          disabled={inert}
          className="flex-1 border-0 bg-transparent text-[14px] outline-none placeholder:text-[var(--outline)] disabled:cursor-not-allowed"
        />
        <button
          type="button"
          onClick={submit}
          disabled={inert || !text.trim()}
          aria-label="Rewrite document"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-white transition-all enabled:hover:scale-105 enabled:active:scale-95 disabled:opacity-40"
          style={{
            background:
              "linear-gradient(135deg, var(--primary), var(--primary-fixed-dim))",
          }}
        >
          {busy ? (
            <Icon name="progress_activity" size={16} className="animate-spin" />
          ) : (
            <Icon name="send" fill size={16} />
          )}
        </button>
      </div>
      {error ? (
        <div className="mt-1.5 px-2 text-[12px] font-bold text-[var(--error)]">
          {error}
        </div>
      ) : null}
    </div>
  );
}

function SidebarCard({
  children,
  padded = true,
}: {
  children: React.ReactNode;
  padded?: boolean;
}) {
  return (
    <div
      className={`overflow-hidden rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] shadow-sm ${padded ? "p-4" : ""}`}
    >
      {children}
    </div>
  );
}

function Metric({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="mb-3">
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="font-bold text-[var(--on-surface)]">{label}</span>
        <span className="font-extrabold tabular-nums" style={{ color }}>
          {value}%
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-container)]">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${value}%`, background: color }}
        />
      </div>
    </div>
  );
}

function TonePill({
  active,
  children,
}: {
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${
        active
          ? "border-[#1aa37e]/40 bg-[#d3f5e8] text-[#0f6e57]"
          : "border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] text-[var(--on-surface-variant)]"
      }`}
    >
      {children}
    </span>
  );
}

/**
 * Strip HTML tags to plain text. Block elements (paragraphs, headings,
 * list items, blockquotes) are separated by a BLANK LINE so downstream
 * `splitParagraphs` sees them as distinct paragraphs.
 */
function htmlToText(html: string): string {
  if (!html) return "";
  return html
    .replace(/<\/(p|h[1-6]|li|blockquote)>/gi, "\n\n")
    .replace(/<br\s*\/?>(?=\s*<)/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function ChecklistItem({
  done,
  children,
  onAskAI,
}: {
  done?: boolean;
  children: React.ReactNode;
  onAskAI?: () => void;
}) {
  return (
    <li className="flex items-center justify-between gap-2 text-sm">
      <span className="inline-flex items-center gap-2">
        {done ? (
          <span className="grid h-5 w-5 place-items-center rounded-full bg-[#1aa37e] text-white">
            <Icon name="check" size={14} fill />
          </span>
        ) : (
          <span className="h-5 w-5 rounded-full border-2 border-[var(--outline-variant)]" />
        )}
        <span
          className={
            done ? "text-[var(--on-surface)]" : "text-[var(--on-surface-variant)]"
          }
        >
          {children}
        </span>
      </span>
      {!done && onAskAI ? (
        <button
          type="button"
          onClick={onAskAI}
          className="inline-flex items-center gap-1 rounded-full border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-2 py-0.5 text-[10px] font-bold text-[var(--primary)] hover:border-[var(--primary)] hover:bg-[var(--primary-container)]/30"
        >
          <Icon name="auto_awesome" size={11} fill />
          Ask AI
        </button>
      ) : null}
    </li>
  );
}
