"use client";

import { useEffect, useMemo, useState } from "react";

import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";

type ParagraphState = "pending" | "accepted" | "rejected";

type RowDecision = {
  /// Index into the maximum of (oldParagraphs.length, newParagraphs.length).
  index: number;
  oldText: string | null;
  newText: string | null;
  state: ParagraphState;
};

type Props = {
  /// Plain-text paragraphs of the current saved variant.
  oldParagraphs: string[];
  /// Plain-text paragraphs returned from /api/sop/rewrite (scope=document).
  newParagraphs: string[];
  /// The user's prompt that produced `newParagraphs` — shown back so they
  /// can re-prompt without retyping.
  prompt: string;
  /// Resolve the review: commit the array of paragraphs the user wants to
  /// keep (mix of old and new based on per-row decisions). Editor swaps the
  /// doc to these paragraphs.
  onAccept: (finalParagraphs: string[]) => void;
  /// Discard the rewrite without changing the doc.
  onReject: () => void;
  /// Reopen the prompt input pre-filled with the original prompt so the
  /// user can re-run with a tweaked instruction.
  onRetry: (prompt: string) => void;
};

/**
 * Whole-document review surface. Renders a side-by-side diff of the
 * current draft vs the AI-proposed rewrite, with per-paragraph
 * accept/reject controls. Defaults to "all new" — the user can flip
 * individual paragraphs back to old before committing.
 */
export function DocumentReview({
  oldParagraphs,
  newParagraphs,
  prompt,
  onAccept,
  onReject,
  onRetry,
}: Props) {
  const initialDecisions = useMemo<RowDecision[]>(() => {
    const len = Math.max(oldParagraphs.length, newParagraphs.length);
    const rows: RowDecision[] = [];
    for (let i = 0; i < len; i++) {
      rows.push({
        index: i,
        oldText: oldParagraphs[i] ?? null,
        newText: newParagraphs[i] ?? null,
        state: "pending",
      });
    }
    return rows;
  }, [oldParagraphs, newParagraphs]);

  const [rows, setRows] = useState<RowDecision[]>(initialDecisions);

  useEffect(() => {
    setRows(initialDecisions);
  }, [initialDecisions]);

  const setRowState = (index: number, state: ParagraphState) => {
    setRows((prev) => prev.map((r) => (r.index === index ? { ...r, state } : r)));
  };

  // What does "Accept all" produce? For pending rows, we use the new
  // paragraph (defaulting to keep changes). For explicit decisions, we
  // honor the user's per-row choice.
  const buildFinal = (defaultPending: "accept" | "reject"): string[] => {
    const final: string[] = [];
    for (const r of rows) {
      const effective: ParagraphState =
        r.state === "pending"
          ? defaultPending === "accept"
            ? "accepted"
            : "rejected"
          : r.state;
      const text =
        effective === "accepted"
          ? r.newText ?? ""
          : r.oldText ?? "";
      if (text.trim().length > 0) final.push(text);
    }
    return final;
  };

  const decidedCount = rows.filter((r) => r.state !== "pending").length;
  const acceptedCount = rows.filter((r) => r.state === "accepted").length;
  const rejectedCount = rows.filter((r) => r.state === "rejected").length;

  const handleAcceptAll = () => onAccept(buildFinal("accept"));
  const handleApplyDecisions = () => onAccept(buildFinal("accept"));

  return (
    <div className="flex flex-col gap-3 rounded-3xl border-2 border-[var(--primary)]/40 bg-[var(--surface-container-lowest)] shadow-lg sop-review-fade-in">
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--outline-variant)] bg-gradient-to-r from-[var(--primary-container)]/40 to-[var(--surface-container-low)] px-4 py-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--primary)] px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.1em] text-white">
          <Icon name="auto_fix_high" size={12} fill />
          Reviewing rewrite
        </span>
        <span className="truncate text-sm text-[var(--on-surface-variant)]">
          {prompt}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            icon="refresh"
            onClick={() => onRetry(prompt)}
          >
            Try again
          </Button>
          <Button size="sm" variant="ghost" icon="close" onClick={onReject}>
            Reject all
          </Button>
          {decidedCount === 0 ? (
            <Button size="sm" icon="check" onClick={handleAcceptAll}>
              Accept all
            </Button>
          ) : (
            <Button size="sm" icon="check" onClick={handleApplyDecisions}>
              Apply ({acceptedCount} new, {rows.length - acceptedCount} kept)
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-[var(--outline-variant)] max-h-[640px] overflow-auto">
        <div className="bg-[var(--surface-container-low)] p-3 sticky top-0 z-10 text-[10px] font-extrabold uppercase tracking-[0.12em] text-[var(--outline)]">
          Original · your draft
        </div>
        <div className="bg-[var(--surface-container-low)] p-3 sticky top-0 z-10 text-[10px] font-extrabold uppercase tracking-[0.12em] text-[var(--outline)]">
          Proposed rewrite
        </div>
        {rows.map((r) => (
          <ReviewRow
            key={r.index}
            row={r}
            onAccept={() => setRowState(r.index, "accepted")}
            onReject={() => setRowState(r.index, "rejected")}
            onClear={() => setRowState(r.index, "pending")}
          />
        ))}
      </div>

      <div className="border-t border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-4 py-2 text-xs text-[var(--on-surface-variant)]">
        {decidedCount === 0 ? (
          <>
            <strong>Tip:</strong> click the green ✓ on individual paragraphs
            to accept just those, or use <strong>Accept all</strong> above to
            replace the whole draft.
          </>
        ) : (
          <>
            {acceptedCount} new · {rejectedCount} kept · {rows.length - decidedCount} undecided
            {rows.length - decidedCount > 0
              ? " (undecided rows default to the new version on Apply)"
              : ""}
          </>
        )}
      </div>
    </div>
  );
}

function ReviewRow({
  row,
  onAccept,
  onReject,
  onClear,
}: {
  row: RowDecision;
  onAccept: () => void;
  onReject: () => void;
  onClear: () => void;
}) {
  const oldDimmed = row.state === "accepted";
  const newDimmed = row.state === "rejected";

  return (
    <>
      <div
        className={`bg-[var(--surface-container-lowest)] p-4 text-[14px] leading-relaxed transition-opacity ${
          oldDimmed ? "opacity-40" : ""
        }`}
      >
        {row.oldText ? (
          <p className="m-0 whitespace-pre-wrap">{row.oldText}</p>
        ) : (
          <p className="m-0 italic text-[var(--outline)]">(none)</p>
        )}
      </div>
      <div
        className={`relative bg-[var(--surface-container-lowest)] p-4 text-[14px] leading-relaxed transition-opacity ${
          newDimmed ? "opacity-40" : ""
        }`}
      >
        {row.newText ? (
          <p
            className={`m-0 whitespace-pre-wrap ${
              row.state === "accepted"
                ? "rounded bg-[#d3f5e8] px-2 py-1 text-[#0f6e57]"
                : ""
            }`}
          >
            {row.newText}
          </p>
        ) : (
          <p className="m-0 italic text-[var(--outline)]">(removed)</p>
        )}
        <div className="mt-2 flex items-center gap-1.5">
          {row.state === "pending" ? (
            <>
              <RowBtn
                variant="accept"
                icon="check"
                label="Use new"
                onClick={onAccept}
              />
              <RowBtn
                variant="reject"
                icon="close"
                label="Keep old"
                onClick={onReject}
              />
            </>
          ) : row.state === "accepted" ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#d3f5e8] px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#0f6e57]">
              <Icon name="check_circle" size={12} fill /> New
              <button
                type="button"
                onClick={onClear}
                aria-label="Undo decision"
                className="ml-1 grid h-4 w-4 place-items-center rounded-full text-[#0f6e57] hover:bg-[#0f6e57]/10"
              >
                <Icon name="close" size={11} />
              </button>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-container)] px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.08em] text-[var(--on-surface-variant)]">
              <Icon name="undo" size={12} /> Kept original
              <button
                type="button"
                onClick={onClear}
                aria-label="Undo decision"
                className="ml-1 grid h-4 w-4 place-items-center rounded-full text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)]"
              >
                <Icon name="close" size={11} />
              </button>
            </span>
          )}
        </div>
      </div>
    </>
  );
}

function RowBtn({
  variant,
  icon,
  label,
  onClick,
}: {
  variant: "accept" | "reject";
  icon: string;
  label: string;
  onClick: () => void;
}) {
  const accept = variant === "accept";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold transition-colors ${
        accept
          ? "bg-[#1aa37e] text-white hover:bg-[#168a6a]"
          : "border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] text-[var(--on-surface-variant)] hover:border-[var(--error)] hover:text-[var(--error)]"
      }`}
    >
      <Icon name={icon} size={12} />
      {label}
    </button>
  );
}
