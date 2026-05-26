"use client";

import { useEffect, useRef, useState } from "react";

import { Icon } from "@/components/icon";
import { MarkdownBody } from "@/components/markdown-body";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ASSISTANT_PENDING_ROLE,
  type ChatMessage,
  useChatHistory,
  useSendMessage,
} from "@/features/assistant/api";
import { isWholeDocumentRewriteRequest } from "@/lib/sop-rewrite-intent";
import { cn } from "@/lib/utils";

import { LibraryPickerDialog } from "./library-picker-dialog";
import { SAMPLE_MASTER_SOP } from "./sample-master-sop";
import type { SopVariantRow } from "./api";

export type OnboardingSubmit =
  | { kind: "paste"; text: string }
  | { kind: "upload"; file: File }
  | { kind: "library"; documentId: string };

type Props = {
  schoolId: string;
  schoolName: string;
  /// When the studio is in "onboarding" (no variant exists yet), the chat
  /// compose box submissions are routed here so the parent can kick off
  /// generation rather than POSTing a normal chat message.
  onboarding: boolean;
  onOnboardingSubmit: (input: OnboardingSubmit) => Promise<void> | void;
  /// Whether onboarding generation is in flight (disables the compose box).
  generating: boolean;
  /// The current saved variant (when present) — surfaces a "Saved variant"
  /// strip at the top of the chat for context.
  variant: SopVariantRow | null;
  /// When set, whole-draft rewrite requests update the editor instead of chat.
  onDocumentRewrite?: (prompt: string) => Promise<void>;
  onSwitchToEditor?: () => void;
};

const ONBOARD_MIN_PASTE_WORDS = 30;

export function SopChatPanel({
  schoolId,
  schoolName,
  onboarding,
  onOnboardingSubmit,
  generating,
  variant,
  onDocumentRewrite,
  onSwitchToEditor,
}: Props) {
  const [input, setInput] = useState("");
  const [libraryOpen, setLibraryOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollAnchor = useRef<HTMLDivElement>(null);

  const historyQuery = useChatHistory("sop", schoolId);
  const sendMutation = useSendMessage();

  const messages = (historyQuery.data ?? []) as ChatMessage[];
  const sending = sendMutation.isPending;

  useEffect(() => {
    scrollAnchor.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, sending, generating]);

  const wordCount = (s: string) =>
    s.trim() ? s.trim().split(/\s+/).length : 0;

  const submit = async () => {
    const text = input.trim();
    if (!text || sending || generating) return;

    if (onboarding) {
      // Long paste during onboarding → treat as master SOP for generation.
      if (wordCount(text) >= ONBOARD_MIN_PASTE_WORDS) {
        setInput("");
        await onOnboardingSubmit({ kind: "paste", text });
        return;
      }
      // Short reply — let the user know we're waiting for the master.
      // We still echo the message via the regular chat so it's preserved
      // in history.
    }

    setInput("");
    if (
      !onboarding &&
      variant &&
      onDocumentRewrite &&
      isWholeDocumentRewriteRequest(text)
    ) {
      onSwitchToEditor?.();
      try {
        await onDocumentRewrite(text);
      } catch (e) {
        console.error("[sop-studio] document rewrite failed", e);
      }
      return;
    }
    try {
      await sendMutation.mutateAsync({ message: text, mode: "sop", schoolId });
    } catch (e) {
      console.error("[sop-studio] send failed", e);
    }
  };

  const onUploadFile = async (file: File) => {
    if (!onboarding || generating) return;
    await onOnboardingSubmit({ kind: "upload", file });
  };

  /**
   * One-click suggestion send. Used by the chips under the compose box —
   * fires the prompt as a normal chat message (with the same optimistic
   * placeholder + invalidation flow as a typed send). Disabled during
   * onboarding because the chat-send path requires an existing variant.
   */
  const sendQuickPrompt = async (prompt: string) => {
    if (sending || generating) return;
    if (
      variant &&
      onDocumentRewrite &&
      isWholeDocumentRewriteRequest(prompt)
    ) {
      onSwitchToEditor?.();
      try {
        await onDocumentRewrite(prompt);
      } catch (e) {
        console.error("[sop-studio] document rewrite failed", e);
      }
      return;
    }
    try {
      await sendMutation.mutateAsync({
        message: prompt,
        mode: "sop",
        schoolId,
      });
    } catch (e) {
      console.error("[sop-studio] quick prompt failed", e);
    }
  };

  return (
    <section className="flex flex-col overflow-hidden rounded-3xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] shadow-sm">
      {onboarding ? <OnboardingStepsBanner generating={generating} /> : null}

      <ScrollArea
        className="h-[min(56vh,520px)] p-6 md:h-[min(62vh,560px)]"
        style={{
          backgroundImage:
            "radial-gradient(circle, color-mix(in srgb, var(--primary-fixed) 45%, transparent) 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
      >
        <div className="flex flex-col gap-5">
          {messages.length === 0 ? (
            <WelcomeBubble schoolName={schoolName} onboarding={onboarding} />
          ) : null}
          {messages.map((m) => (
            <Bubble key={m.id} message={m} />
          ))}
          {variant && messages.length === 0 && !onboarding ? (
            <SavedVariantBubble variant={variant} />
          ) : null}
          {/* Onboarding generation isn't a chat send, so it has no
              optimistic cache placeholder — render the explicit thinking
              bubble for that path only. Regular chat sends surface their
              "Thinking…" state via the optimistic ASSISTANT_PENDING_ROLE
              entry above. */}
          {generating ? <ThinkingBubble onboarding={onboarding} /> : null}
          <div ref={scrollAnchor} />
        </div>
      </ScrollArea>

      <LibraryPickerDialog
        open={libraryOpen}
        onOpenChange={setLibraryOpen}
        selecting={generating}
        onSelect={async (documentId) => {
          setLibraryOpen(false);
          await onOnboardingSubmit({ kind: "library", documentId });
        }}
      />

      <ComposeBox
        value={input}
        onChange={setInput}
        onSubmit={submit}
        onUpload={onUploadFile}
        placeholder={
          onboarding
            ? "Paste your master SOP here, or hit 📎 to upload a file…"
            : "Tell me what to change — e.g. ‘tighten the opening’"
        }
        disabled={generating}
        fileRef={fileRef}
        hint={
          onboarding ? (
            <>
              <HintChip
                icon="folder_open"
                disabled={generating}
                onClick={() => setLibraryOpen(true)}
              >
                Pick from your library
              </HintChip>
              <HintChip
                icon="lightbulb"
                disabled={generating}
                onClick={() => void onOnboardingSubmit({ kind: "paste", text: SAMPLE_MASTER_SOP })}
              >
                Use a sample SOP
              </HintChip>
            </>
          ) : (
            <>
              <HintChip
                icon="bolt"
                disabled={sending}
                onClick={() => void sendQuickPrompt("Tighten the opening")}
              >
                Tighten the opening
              </HintChip>
              <HintChip
                icon="bolt"
                disabled={sending}
                onClick={() =>
                  void sendQuickPrompt(
                    "Rewrite the fit paragraph with more specific program details for this school.",
                  )
                }
              >
                Rewrite fit paragraph
              </HintChip>
              <HintChip
                icon="bolt"
                disabled={sending}
                onClick={() =>
                  void sendQuickPrompt(
                    "Cut the draft to about 650 words while preserving the strongest claims.",
                  )
                }
              >
                Cut to 650 words
              </HintChip>
            </>
          )
        }
      />
    </section>
  );
}

function OnboardingStepsBanner({ generating }: { generating: boolean }) {
  const steps = [
    { n: 1, label: "Add your master SOP" },
    { n: 2, label: "We draft for this school" },
    { n: 3, label: "Refine in chat or editor" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-4 py-3">
      {steps.map((step, i) => (
        <span key={step.n} className="inline-flex items-center gap-2">
          <span
            className={cn(
              "grid h-6 w-6 place-items-center rounded-full text-[11px] font-extrabold",
              i === 0
                ? "bg-[var(--primary)] text-white"
                : "border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] text-[var(--on-surface-variant)]",
            )}
          >
            {step.n}
          </span>
          <span
            className={cn(
              "text-xs font-semibold",
              i === 0 ? "text-[var(--on-surface)]" : "text-[var(--on-surface-variant)]",
            )}
          >
            {step.label}
          </span>
          {i < steps.length - 1 ? (
            <Icon name="chevron_right" size={14} className="text-[var(--outline)]" />
          ) : null}
        </span>
      ))}
      {generating ? (
        <span className="ml-auto text-xs font-bold text-[var(--primary)]">Drafting…</span>
      ) : null}
    </div>
  );
}

function WelcomeBubble({
  schoolName,
  onboarding,
}: {
  schoolName: string;
  onboarding: boolean;
}) {
  return (
    <AssistantShell>
      <div className="space-y-2">
        <p className="m-0 text-[15px] leading-relaxed">
          Let&apos;s tailor your statement of purpose for{" "}
          <strong className="text-[var(--primary)]">{schoolName}</strong>.
        </p>
        {onboarding ? (
          <>
            <p className="m-0 text-[14px] leading-relaxed text-[var(--on-surface-variant)]">
              Start with a master SOP you already have. Paste below, upload a file, pick
              from your library, or try the sample to see how tailoring works.
            </p>
            <ul className="m-0 grid gap-2 pl-0 text-[13px] text-[var(--on-surface-variant)]">
              <li className="flex items-start gap-2">
                <Icon name="edit" size={16} className="mt-0.5 shrink-0 text-[var(--primary)]" />
                <span>Paste at least ~30 words in the box and press Enter</span>
              </li>
              <li className="flex items-start gap-2">
                <Icon name="attach_file" size={16} className="mt-0.5 shrink-0 text-[var(--primary)]" />
                <span>Upload PDF or DOCX with the attach button</span>
              </li>
              <li className="flex items-start gap-2">
                <Icon name="folder_open" size={16} className="mt-0.5 shrink-0 text-[var(--primary)]" />
                <span>Use &quot;Pick from your library&quot; for saved SOP drafts</span>
              </li>
            </ul>
          </>
        ) : (
          <p className="m-0 text-[14px] leading-relaxed text-[var(--on-surface-variant)]">
            Your tailored variant is loaded in the editor. Tell me what to
            change and I&apos;ll rewrite it.
          </p>
        )}
      </div>
    </AssistantShell>
  );
}

function SavedVariantBubble({ variant }: { variant: SopVariantRow }) {
  return (
    <AssistantShell>
      <div className="text-sm">
        <div className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-[var(--primary-container)] px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.08em] text-[var(--on-primary-container)]">
          <Icon name="bookmark" size={12} fill />
          Saved variant
        </div>
        <div className="font-bold text-[var(--on-surface)]">{variant.title}</div>
        <div className="text-xs text-[var(--on-surface-variant)]">
          Last updated {new Date(variant.updatedAt).toLocaleDateString()}
        </div>
      </div>
    </AssistantShell>
  );
}

function ThinkingBubble({ onboarding }: { onboarding: boolean }) {
  return (
    <AssistantShell>
      <span className="sop-thinking-dots inline-flex items-center gap-1.5 text-sm text-[var(--on-surface-variant)]">
        {onboarding ? "Reading and drafting" : "Thinking"}
        <span className="dot" />
        <span className="dot" />
        <span className="dot" />
      </span>
    </AssistantShell>
  );
}

function Bubble({ message }: { message: ChatMessage }) {
  // Optimistic placeholder while a send is in flight — same visual as the
  // explicit ThinkingBubble so streamed sends from outside the chat panel
  // (e.g. checklist Ask-AI) immediately surface a loading state.
  if (message.role === ASSISTANT_PENDING_ROLE) {
    return (
      <AssistantShell>
        <span className="sop-thinking-dots inline-flex items-center gap-1.5 text-sm text-[var(--on-surface-variant)]">
          Thinking
          <span className="dot" />
          <span className="dot" />
          <span className="dot" />
        </span>
      </AssistantShell>
    );
  }
  if (message.role === "assistant") {
    return (
      <AssistantShell>
        <MarkdownBody content={message.content} />
      </AssistantShell>
    );
  }
  return (
    <div className="flex flex-row-reverse items-start gap-3.5 self-end">
      <UserAvatar />
      <div className="rounded-2xl rounded-br border border-[var(--primary-container)]/40 bg-[var(--primary-container)] px-5 py-3.5 text-[15px] leading-relaxed text-[var(--on-primary-container)] shadow-sm">
        <p className="m-0 whitespace-pre-wrap">{message.content}</p>
      </div>
    </div>
  );
}

function AssistantShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3.5">
      <AssistantAvatar />
      <div className="rounded-2xl rounded-bl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-5 py-4 shadow-sm">
        {children}
      </div>
    </div>
  );
}

function AssistantAvatar() {
  return (
    <div
      className="sop-avatar-pulse grid h-10 w-10 shrink-0 place-items-center rounded-full"
      style={{
        background:
          "linear-gradient(135deg, var(--primary) 0%, var(--primary-fixed-dim) 100%)",
        boxShadow: "0 8px 20px -6px rgba(0,98,157,0.45)",
      }}
    >
      <Icon name="auto_awesome" fill size={22} className="text-white" />
    </div>
  );
}

function UserAvatar() {
  return (
    <div
      className="grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 text-sm font-extrabold"
      style={{
        background:
          "linear-gradient(135deg, var(--primary-fixed), var(--primary-fixed-dim))",
        borderColor: "var(--primary-container)",
        color: "var(--primary)",
      }}
    >
      <Icon name="person" size={20} />
    </div>
  );
}

function ComposeBox({
  value,
  onChange,
  onSubmit,
  onUpload,
  placeholder,
  disabled,
  fileRef,
  hint,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onUpload: (f: File) => void;
  placeholder: string;
  disabled?: boolean;
  fileRef: React.RefObject<HTMLInputElement | null>;
  hint: React.ReactNode;
}) {
  return (
    <div className="border-t border-[var(--outline-variant)] bg-gradient-to-b from-[var(--surface-container-lowest)] to-[var(--surface-container-low)] p-4 md:p-5">
      <div className="flex items-end gap-1.5 rounded-3xl border-2 border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-2.5 shadow-sm transition-all focus-within:border-[var(--primary)] focus-within:shadow-[0_0_0_4px_color-mix(in_srgb,var(--primary)_15%,transparent)]">
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.docx,.txt"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onUpload(f);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          aria-label="Upload SOP file"
          title="Upload PDF or DOCX"
          disabled={disabled}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[var(--outline)] transition-all hover:bg-[var(--primary-container)] hover:text-[var(--primary)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Icon name="attach_file" size={20} />
        </button>
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSubmit();
            }
          }}
          placeholder={placeholder}
          rows={1}
          disabled={disabled}
          className="flex-1 resize-none border-0 bg-transparent px-2 py-2.5 text-[15px] leading-relaxed focus-visible:ring-0 min-h-[44px] max-h-[200px]"
        />
        <button
          type="button"
          onClick={onSubmit}
          disabled={disabled || !value.trim()}
          aria-label="Send"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-white shadow-md transition-all enabled:hover:scale-105 enabled:active:scale-95 disabled:opacity-40"
          style={{
            background:
              "linear-gradient(135deg, var(--primary), var(--primary-fixed-dim))",
          }}
        >
          <Icon name="arrow_upward" fill size={20} />
        </button>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="flex flex-wrap gap-1.5">{hint}</div>
        <span className="text-[11px] text-[var(--outline)]">
          Enter to send · Shift+Enter for newline
        </span>
      </div>
    </div>
  );
}

function HintChip({
  icon,
  children,
  onClick,
  disabled,
}: {
  icon: string;
  children: React.ReactNode;
  /// Optional — when provided the chip becomes a button that fires this
  /// handler. Without it the chip stays decorative (used for onboarding
  /// hints that don't yet have wiring).
  onClick?: () => void;
  disabled?: boolean;
}) {
  if (!onClick) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-2.5 py-1 text-[11px] font-bold text-[var(--on-surface-variant)]">
        <Icon name={icon} size={12} className="text-[var(--primary)]" />
        {children}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-2.5 py-1 text-[11px] font-bold text-[var(--on-surface-variant)] transition-all hover:border-[var(--primary)] hover:bg-[var(--primary-container)]/40 hover:text-[var(--on-surface)] disabled:cursor-not-allowed disabled:opacity-40"
    >
      <Icon name={icon} size={12} className="text-[var(--primary)]" />
      {children}
    </button>
  );
}
