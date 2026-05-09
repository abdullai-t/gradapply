"use client";

import { apiFetch } from "@/lib/api-fetch";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";

import { Icon } from "@/components/icon";
import { PageLoader } from "@/components/page-loader";
import {
  useChatHistory,
  useSendMessage,
} from "@/features/assistant/api";
import { useSchools } from "@/features/schools/api";
import { messageFromApiErrorPayload } from "@/lib/api-error-json";

import { useGenerateVariant, useSopVariant } from "./api";
import { SopChatPanel, type OnboardingSubmit } from "./chat-panel";
import { SopEditorPanel } from "./editor-panel";
import { StudioStyles } from "./studio-styles";

type View = "chat" | "editor";

const VIEW_PREF_KEY = "gradapply:sop-studio-view";

type Props = {
  schoolId: string;
};

/**
 * Top-level SOP studio. Decides whether to onboard the user (no variant
 * yet) or jump straight to the editor (variant exists). Owns the
 * Chat ↔ Editor view toggle and brokers cross-panel actions like
 * "rewrite via the chat" → triggers a chat send for the editor.
 */
export function SopStudio({ schoolId }: Props) {
  const { data: session } = useSession();
  const schoolsQuery = useSchools();
  const variantQuery = useSopVariant(schoolId);
  const generateMutation = useGenerateVariant(schoolId);
  const sendChat = useSendMessage();
  const chatHistoryQuery = useChatHistory("sop", schoolId);

  const [view, setViewState] = useState<View>("editor");
  const [hydratedView, setHydratedView] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);

  // Hydrate view preference from localStorage once the schoolId is known.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(VIEW_PREF_KEY) as View | null;
    if (saved === "chat" || saved === "editor") setViewState(saved);
    setHydratedView(true);
  }, []);

  const setView = (v: View) => {
    setViewState(v);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(VIEW_PREF_KEY, v);
    }
  };

  const school = useMemo(
    () => schoolsQuery.data?.find((s) => s.id === schoolId) ?? null,
    [schoolsQuery.data, schoolId],
  );
  const variant = variantQuery.data ?? null;

  const loading =
    schoolsQuery.isLoading ||
    variantQuery.isLoading ||
    chatHistoryQuery.isLoading ||
    !hydratedView;

  // After AI rewrite via chat, briefly flash the editor.
  useEffect(() => {
    if (!sendChat.isSuccess) return;
    setFlash(true);
    const t = setTimeout(() => setFlash(false), 900);
    return () => clearTimeout(t);
  }, [sendChat.isSuccess]);

  const handleOnboardingSubmit = async (input: OnboardingSubmit) => {
    setError(null);
    try {
      if (input.kind === "paste") {
        await generateMutation.mutateAsync({ masterText: input.text });
      } else {
        const docId = await uploadMasterAsLibraryDoc(input.file);
        await generateMutation.mutateAsync({ masterDocumentId: docId });
      }
      // After first generation succeeds, default the view to the editor so
      // the user can see what was created.
      setView("editor");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    }
  };

  // Editor-side "Ask AI" affordances (checklist suggestions, etc.) feed
  // their prompts into the chat. Switch the user to the Chat view so the
  // request and the streaming reply are visible — otherwise the click
  // looks silent until they happen to flip tabs.
  const handleAskAI = (prompt: string) => {
    setError(null);
    setView("chat");
    sendChat.mutate(
      { message: prompt, mode: "sop", schoolId },
      {
        onError: (e) => {
          setError(e instanceof Error ? e.message : "Refinement failed");
        },
      },
    );
  };

  if (loading) {
    return <PageLoader label="Loading SOP studio…" />;
  }

  if (!school) {
    return (
      <div className="rounded-2xl border border-[var(--error)]/40 bg-[var(--error-container)]/40 p-6">
        <h2 className="t-title-lg m-0 text-[var(--on-surface)]">
          School not found
        </h2>
        <p className="mt-2 text-sm text-[var(--on-surface-variant)]">
          We couldn&apos;t find that school in your list.{" "}
          <Link href="/schools" className="font-bold text-[var(--primary)] underline">
            Back to schools
          </Link>
        </p>
      </div>
    );
  }

  const onboarding = !variant;
  const generating = generateMutation.isPending;

  return (
    <div className="slide-in space-y-5 pb-8">
      <StudioStyles />

      <header className="flex flex-wrap items-center gap-2 rounded-full border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 py-1.5 text-sm shadow-sm">
        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--primary)] px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.1em] text-white">
          <Icon name="target" size={10} fill />
          Working on
        </span>
        <Link
          href="/schools"
          className="font-bold text-[var(--on-surface)] hover:text-[var(--primary)] hover:underline"
        >
          {school.name}
        </Link>
        {school.program ? (
          <>
            <span className="text-[var(--outline)]">·</span>
            <span className="text-[var(--on-surface-variant)]">
              {school.program}
              {school.degree ? ` · ${school.degree}` : ""}
            </span>
          </>
        ) : null}
        <Link
          href="/assistant"
          className="ml-auto inline-flex items-center gap-1 text-xs font-bold text-[var(--outline)] hover:text-[var(--on-surface)]"
        >
          <Icon name="close" size={14} />
          Exit studio
        </Link>
      </header>

      {error ? (
        <div className="glass-alert-error" role="alert">
          {error}
        </div>
      ) : null}

      {!onboarding ? (
        <div className="flex justify-center">
          <ViewToggle view={view} setView={setView} />
        </div>
      ) : null}

      {onboarding || view === "chat" ? (
        <div className={onboarding ? "mx-auto max-w-[760px]" : "mx-auto max-w-[860px]"}>
          <SopChatPanel
            schoolId={schoolId}
            schoolName={school.name}
            onboarding={onboarding}
            onOnboardingSubmit={handleOnboardingSubmit}
            generating={generating}
            variant={variant}
          />
        </div>
      ) : (
        <SopEditorPanel
          schoolId={schoolId}
          schoolName={school.name}
          schoolProgram={school.program}
          schoolDegree={school.degree}
          schoolCountry={school.country}
          variant={variant!}
          onAskAI={handleAskAI}
          flash={flash}
        />
      )}

      {/* Greeting initials are unused but the session lookup keeps the
          studio aware of the signed-in user; the chat panel itself reads
          the session indirectly via existing assistant primitives. */}
      <span className="hidden">{session?.user?.email}</span>
    </div>
  );
}

function ViewToggle({
  view,
  setView,
}: {
  view: View;
  setView: (v: View) => void;
}) {
  const items: { id: View; label: string; icon: string }[] = [
    { id: "chat", label: "Chat", icon: "chat_bubble" },
    { id: "editor", label: "SOP Editor", icon: "edit_note" },
  ];
  return (
    <div className="inline-flex rounded-full border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-1 shadow-sm">
      {items.map((v) => {
        const active = view === v.id;
        return (
          <button
            key={v.id}
            type="button"
            onClick={() => setView(v.id)}
            className={`inline-flex items-center gap-1.5 rounded-full px-5 py-1.5 text-sm font-bold transition-all ${
              active
                ? "bg-[var(--primary)] text-white shadow-md"
                : "text-[var(--on-surface-variant)] hover:bg-[var(--surface-container)]"
            }`}
          >
            <Icon name={v.icon} size={16} fill={active} />
            {v.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Uploads a master SOP file as a `sop_draft` document so the existing
 * /api/sop/variants flow can read its text via `extractPlainTextFromStoredDocument`.
 * Throws with the API error message on failure.
 */
async function uploadMasterAsLibraryDoc(file: File): Promise<string> {
  const form = new FormData();
  form.set("file", file);
  form.set("kind", "sop_draft");
  const res = await apiFetch("/api/documents/upload", {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(messageFromApiErrorPayload(body));
  }
  const doc = (await res.json()) as { id: string };
  return doc.id;
}
