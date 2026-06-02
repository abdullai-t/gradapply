"use client";

import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSession } from "@/hooks/use-auth";

import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Icon } from "@/components/icon";
import { FreePlanGate } from "@/components/free-plan-gate";

import { AgentChips, type ChatMode } from "@/features/assistant/agent-chips";
import {
  ASSISTANT_PENDING_ROLE,
  type ChatMessage as Msg,
  useChatHistory,
  useSendMessageStreaming,
} from "@/features/assistant/api";
import { AIBubble, UserBubble } from "@/features/assistant/bubbles";
import { SopStudio } from "@/features/sop-studio/studio";
import { usePlanTier } from "@/hooks/use-plan-tier";

const MarkdownBody = dynamic(
  () =>
    import("@/components/markdown-body").then((m) => ({
      default: m.MarkdownBody as ComponentType<{
        content: string;
        className?: string;
      }>,
    })),
  {
    loading: () => (
      <div className="flex flex-col gap-2">
        <div className="h-4 w-3/4 animate-pulse rounded bg-[var(--surface-container-high)]" />
        <div className="h-4 w-full animate-pulse rounded bg-[var(--surface-container-high)]" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-[var(--surface-container-high)]" />
      </div>
    ),
    ssr: false,
  },
);

export default function AssistantPage() {
  const searchParams = useSearchParams();
  const studioSchoolId = searchParams.get("schoolId");
  const studioMode = searchParams.get("mode");

  const { planTier } = usePlanTier();

  // SOP studio takes over the page when a school is supplied with sop mode.
  // The studio gates internally on plan tier via the same FREE-plan UX
  // shown below for the standard chat.
  if (studioSchoolId && studioMode === "sop") {
    if (planTier === "FREE") {
      return (
        <FreePlanGate
          icon="auto_awesome"
          title="Unlock the SOP studio"
          body="The SOP studio uses the AI assistant. Upgrade in Settings to start tailoring statements per school."
        />
      );
    }
    return <SopStudio schoolId={studioSchoolId} />;
  }

  return <AssistantChat />;
}

function AssistantChat() {
  const { data: session } = useSession();
  const initials = computeInitials(session?.user?.name, session?.user?.email);

  const [mode, setMode] = useState<ChatMode>("sop");
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const { planTier, allowance } = usePlanTier();
  const historyQuery = useChatHistory(mode);
  const { send: sendStreaming, getStreamingId } = useSendMessageStreaming();

  // Surface fetch errors as the page-level error banner.
  useEffect(() => {
    if (historyQuery.isError && historyQuery.error instanceof Error) {
      setError(historyQuery.error.message);
    } else if (historyQuery.isSuccess) {
      setError(null);
    }
  }, [historyQuery.isError, historyQuery.error, historyQuery.isSuccess]);

  const messages = useMemo(
    () => (historyQuery.data ?? []) as Msg[],
    [historyQuery.data],
  );
  const [isStreaming, setIsStreaming] = useState(false);
  const loading = isStreaming;

  useEffect(() => {
    // During streaming, scroll instantly so the animation doesn't compete
    // with each new token's repaint — smooth scroll restarting on every token
    // is what makes the chat feel jittery. Use smooth scroll only when the
    // message count changes (a new turn) and we're not actively streaming.
    bottomRef.current?.scrollIntoView({
      behavior: loading ? "auto" : "smooth",
    });
  }, [messages, loading]);

  const send = async () => {
    if (!input.trim() || loading) return;
    setError(null);
    const text = input;
    setInput("");
    setIsStreaming(true);
    try {
      await sendStreaming({ message: text, mode });
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setIsStreaming(false);
    }
  };

  const remaining = allowance
    ? Math.max(0, allowance.cap - allowance.used) + allowance.purchasedCredits
    : null;
  const hint = HINTS[mode];

  if (planTier === "FREE") {
    return (
      <FreePlanGate
        icon="auto_awesome"
        title="Unlock the AI assistant"
          body="The assistant is available on Plus and Pro plans. Upgrade in Settings to start chatting with the SOP, email, and feedback agents."
      />
    );
  }

  return (
    <div className="slide-in flex flex-col gap-6 pb-8">
      <header>
        <h1 className="t-headline-lg m-0 text-[var(--on-surface)]">
          AI assistant
        </h1>
        <p className="mt-1.5 text-[15px] text-[var(--on-surface-variant)]">
          Multiple task-tuned agents run under the hood; each reply is grounded
          in your{" "}
          <Link
            href="/profile"
            className="font-bold text-[var(--primary)] underline-offset-4 hover:underline"
          >
            profile
          </Link>{" "}
          and{" "}
          <Link
            href="/documents"
            className="font-bold text-[var(--primary)] underline-offset-4 hover:underline"
          >
            uploaded documents
          </Link>{" "}
          when available.
        </p>
      </header>

      {error ? (
        <div className="glass-alert-error" role="alert">
          {error}
        </div>
      ) : null}

      <div className="rounded-3xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-4 md:p-5">
        <AgentChips value={mode} onChange={setMode} />
      </div>

      <div className="overflow-hidden rounded-3xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)]">
        <ScrollArea
          className="h-[480px] p-6"
          style={{
            backgroundImage:
              "radial-gradient(circle, color-mix(in srgb, var(--primary-fixed) 50%, transparent) 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }}
        >
          <div className="flex flex-col gap-5">
            {historyQuery.isLoading ? (
              <>
                <AIBubble>
                  <div className="flex flex-col gap-2">
                    <div className="h-3 w-3/4 animate-pulse rounded bg-[var(--surface-container-high)]" />
                    <div className="h-3 w-full animate-pulse rounded bg-[var(--surface-container-high)]" />
                    <div className="h-3 w-1/2 animate-pulse rounded bg-[var(--surface-container-high)]" />
                  </div>
                </AIBubble>
                <UserBubble initials={initials}>
                  <div className="flex flex-col gap-2">
                    <div className="h-3 w-48 animate-pulse rounded bg-[var(--surface-container-high)]" />
                    <div className="h-3 w-32 animate-pulse rounded bg-[var(--surface-container-high)]" />
                  </div>
                </UserBubble>
              </>
            ) : messages.length === 0 ? (
              <AIBubble>
                <p className="m-0">{hint}</p>
              </AIBubble>
            ) : null}
            {messages.map((msg) => {
              if (msg.role === "user") {
                return (
                  <UserBubble key={msg.id} initials={initials}>
                    <span className="whitespace-pre-wrap">{msg.content}</span>
                  </UserBubble>
                );
              }

              if (msg.role === ASSISTANT_PENDING_ROLE) {
                return (
                  <AIBubble key={msg.id}>
                    <span className="inline-flex items-center gap-2 text-[var(--on-surface-variant)]">
                      <Icon name="more_horiz" className="animate-pulse" size={20} />
                      Thinking…
                    </span>
                  </AIBubble>
                );
              }

              // assistant — both streaming and persisted use the same branch
              const isThisStreaming = msg.id === getStreamingId();
              return (
                <AIBubble key={msg.id}>
                  {!msg.content && isThisStreaming ? (
                    <span className="inline-flex items-center gap-2 text-[var(--on-surface-variant)]">
                      <Icon name="more_horiz" className="animate-pulse" size={20} />
                      Thinking…
                    </span>
                  ) : (
                    <>
                      <MarkdownBody content={msg.content} />
                      {isThisStreaming && (
                        <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-[var(--primary)]" />
                      )}
                    </>
                  )}
                </AIBubble>
              );
            })}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        <div className="border-t border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-4 md:p-5">
          <div className="flex items-end gap-2 rounded-full border-2 border-[var(--outline-variant)] bg-[var(--surface-container)] p-2">
            <button
              type="button"
              aria-label="Attach (coming soon)"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[var(--outline)] transition-colors hover:bg-[var(--surface-container-high)] hover:text-[var(--on-surface)]"
              tabIndex={-1}
            >
              <Icon name="attach_file" size={20} />
            </button>
            <Textarea
              placeholder="Type your message here..."
              className="flex-1 resize-none border-0 bg-transparent px-2 py-2 text-[15px] focus-visible:ring-0 min-h-[48px]"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void send();
                }
              }}
              rows={1}
            />
            <button
              type="button"
              aria-label="Send"
              onClick={() => void send()}
              disabled={loading || !input.trim()}
              className="tactile grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--primary)] text-white shadow-tactile-active disabled:opacity-50"
              style={{ boxShadow: "0 4px 0 0 #004a77" }}
            >
              <Icon name="send" fill size={20} />
            </button>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between px-3 text-xs text-[var(--outline)]">
            <span>
              GradApply AI · {planTier ?? "—"} ·{" "}
              <span className="font-bold text-[var(--on-surface-variant)]">
                {modeLabel(mode)}
              </span>{" "}
              mode
            </span>
            <span>
              {remaining != null
                ? `${remaining} actions remaining this month`
                : "Cmd / Ctrl + Enter to send"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

const HINTS: Record<ChatMode, string> = {
  sop:
    "Let's work on your statement of purpose — narrative arc, specificity, fit. Where do you want to start?",
  email:
    "Polish outreach messages before you send them. Paste the draft and I'll suggest tightening.",
  feedback:
    "Ask for blunt, constructive critique on strategy. I'll be honest about what's working and what isn't.",
};

function modeLabel(m: ChatMode): string {
  return m === "sop" ? "SOP" : m.charAt(0).toUpperCase() + m.slice(1);
}

function computeInitials(name: string | null | undefined, email: string | null | undefined): string {
  if (name?.trim()) {
    return name
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }
  if (email?.trim()) {
    return email.slice(0, 2).toUpperCase();
  }
  return "?";
}
