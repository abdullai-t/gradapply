"use client";

import Link from "next/link";

import { PageLoader } from "@/components/page-loader";
import { useCollaborationSessions } from "@/features/collaboration/api";

export default function CollaborationPage() {
  const { data, isLoading, error } = useCollaborationSessions();

  if (isLoading) return <PageLoader />;

  const sessions = data?.sessions ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-12">
      <div>
        <h1 className="text-2xl font-extrabold text-[var(--on-surface)]">
          Review sessions
        </h1>
        <p className="mt-1 text-sm text-[var(--on-surface-variant)]">
          Async feedback and live co-editing with other scholars on shared draft
          snapshots.
        </p>
      </div>

      {error ? (
        <p className="text-sm text-[var(--error)]">
          {error instanceof Error ? error.message : "Could not load sessions"}
        </p>
      ) : null}

      {sessions.length === 0 ? (
        <div className="scholar-manuscript rounded-xl border border-dashed border-[var(--outline-variant)] p-8 text-center text-sm text-[var(--on-surface-variant)]">
          No review sessions yet. Use{" "}
          <strong className="text-[var(--on-surface)]">Share for review</strong>{" "}
          from SOP studio or a professor email draft.
        </div>
      ) : (
        <ul className="space-y-2">
          {sessions.map((s) => (
            <li key={s.id}>
              <Link
                href={`/collaboration/${s.id}`}
                className="block rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-4 py-3 transition hover:border-[var(--primary)]/40"
              >
                <p className="font-semibold text-[var(--on-surface)]">
                  {s.title}
                </p>
                <p className="mt-0.5 text-xs text-[var(--on-surface-variant)]">
                  {s.isOwner ? "You host" : `Hosted by ${s.ownerName ?? "scholar"}`}{" "}
                  · {s.status} · {s.commentCount} comment
                  {s.commentCount === 1 ? "" : "s"}
                  {s.liveEnabled ? " · Live" : ""}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
