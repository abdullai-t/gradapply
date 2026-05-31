"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageLoader } from "@/components/page-loader";
import { StudioStyles } from "@/features/sop-studio/studio-styles";
import { bodyToEditorHtml, isBlockHtml } from "@/lib/sop-paragraphs";

import type { ArtifactSnapshot } from "./api";
import {
  useAddCollaborationComment,
  useCollaborationSession,
  useRefreshCollaborationArtifact,
  useUpdateCollaborationSession,
} from "./api";
import { GoogleDocsLinkButton } from "@/features/google-docs/google-docs-link-button";

import { CollaborationLivePanel } from "./live-panel";

type Props = {
  sessionId: string;
  guestToken?: string;
  backHref?: string;
};

function sanitizeSnapshotHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/\s+on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
}

function SnapshotHtmlBody({ body, emptyLabel }: { body: string; emptyLabel: string }) {
  const html = useMemo(() => {
    const trimmed = body.trim();
    if (!trimmed) return "";
    return sanitizeSnapshotHtml(bodyToEditorHtml(trimmed));
  }, [body]);

  if (!html) {
    return (
      <p className="text-sm text-[var(--on-surface-variant)]">{emptyLabel}</p>
    );
  }

  return (
    <>
      <StudioStyles />
      <div
        className="prose-doc text-sm text-[var(--on-surface)]"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </>
  );
}

function ArtifactBody({ snapshot }: { snapshot: ArtifactSnapshot }) {
  const emailBody = snapshot.body?.trim() ?? "";

  if (snapshot.emailSubject) {
    return (
      <div className="scholar-manuscript space-y-3 rounded-xl border border-[var(--outline-variant)] p-4 text-sm">
        <p className="font-semibold text-[var(--on-surface)]">
          Subject: {snapshot.emailSubject}
        </p>
        {snapshot.profName ? (
          <p className="text-[var(--on-surface-variant)]">
            To: {snapshot.profName}
          </p>
        ) : null}
        {isBlockHtml(emailBody) ? (
          <SnapshotHtmlBody body={emailBody} emptyLabel="(empty body)" />
        ) : (
          <pre className="whitespace-pre-wrap font-sans text-[var(--on-surface)]">
            {emailBody || "(empty body)"}
          </pre>
        )}
      </div>
    );
  }

  return (
    <div className="scholar-manuscript rounded-xl border border-[var(--outline-variant)] p-4">
      {snapshot.title ? (
        <h3 className="mb-2 text-sm font-semibold text-[var(--on-surface)]">
          {snapshot.title}
        </h3>
      ) : null}
      <SnapshotHtmlBody body={snapshot.body ?? ""} emptyLabel="(empty draft)" />
    </div>
  );
}

export function CollaborationSessionView({
  sessionId,
  guestToken,
  backHref = "/collaboration",
}: Props) {
  const query = useCollaborationSession(sessionId, guestToken);
  const addComment = useAddCollaborationComment(sessionId, guestToken);
  const refreshArtifact = useRefreshCollaborationArtifact(sessionId);
  const updateSession = useUpdateCollaborationSession(sessionId);

  const [commentBody, setCommentBody] = useState("");
  const [guestLabel, setGuestLabel] = useState("");

  const data = query.data;
  const session = data?.session;
  const access = data?.access;

  const snapshot = useMemo(
    () => session?.artifact?.snapshot as ArtifactSnapshot | undefined,
    [session?.artifact?.snapshot],
  );

  if (query.isLoading) return <PageLoader />;
  if (!session || !access) {
    return (
      <p className="text-sm text-[var(--on-surface-variant)]">
        Review session not found or you do not have access.
      </p>
    );
  }

  const isGuest = access.kind === "guest";
  const canManage = access.canManage;

  const submitComment = async () => {
    if (!commentBody.trim()) return;
    await addComment.mutateAsync({
      body: commentBody.trim(),
      ...(isGuest && guestLabel.trim()
        ? { guestLabel: guestLabel.trim() }
        : isGuest
          ? { guestLabel: "Guest" }
          : {}),
    });
    setCommentBody("");
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 pb-12">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href={backHref}
            className="text-xs font-semibold uppercase tracking-wide text-[var(--primary)]"
          >
            ← Back
          </Link>
          <h1 className="mt-1 text-2xl font-extrabold text-[var(--on-surface)]">
            {session.title}
          </h1>
          <p className="text-sm text-[var(--on-surface-variant)]">
            Hosted by {session.ownerName ?? "a scholar"} ·{" "}
            {session.status === "OPEN" ? "Open for comments" : "Closed"}
            {session.artifact
              ? ` · Snapshot v${session.artifact.version}`
              : ""}
          </p>
        </div>
        {canManage ? (
          <div className="flex flex-col items-end gap-2">
            <GoogleDocsLinkButton
              entityType="COLLABORATION_SESSION"
              entityId={sessionId}
            />
            <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={refreshArtifact.isPending}
              onClick={() => void refreshArtifact.mutateAsync()}
            >
              Publish update
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                void updateSession.mutateAsync({
                  liveEnabled: !session.liveEnabled,
                })
              }
            >
              {session.liveEnabled ? "End live" : "Start live"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                void updateSession.mutateAsync({
                  status: session.status === "OPEN" ? "CLOSED" : "OPEN",
                })
              }
            >
              {session.status === "OPEN" ? "Close session" : "Reopen"}
            </Button>
            </div>
          </div>
        ) : null}
      </div>

      {session.liveEnabled && session.liveRoomId ? (
        <CollaborationLivePanel
          roomId={session.liveRoomId}
          sessionId={sessionId}
          initialBody={snapshot?.body ?? ""}
          guestToken={guestToken}
          canEdit={
            canManage ||
            (access.kind === "member" && access.role === "EDITOR")
          }
          onEndLive={
            canManage
              ? (body) => {
                  void updateSession.mutateAsync({ liveEnabled: false });
                  if (body.trim()) {
                    void fetch(
                      `/api/collaboration/sessions/${sessionId}/persist-live`,
                      {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ body }),
                      },
                    );
                  }
                }
              : undefined
          }
        />
      ) : snapshot ? (
        <ArtifactBody snapshot={snapshot} />
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-extrabold uppercase tracking-wide text-[var(--outline)]">
          Comments
        </h2>
        <ul className="space-y-2">
          {session.comments.length === 0 ? (
            <li className="text-sm text-[var(--on-surface-variant)]">
              No comments yet.
            </li>
          ) : (
            session.comments.map((c) => (
              <li
                key={c.id}
                className="rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-3 py-2 text-sm"
              >
                <p className="text-xs font-semibold text-[var(--on-surface-variant)]">
                  {c.authorName ?? c.guestLabel ?? "Reviewer"} ·{" "}
                  {new Date(c.createdAt).toLocaleString()}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-[var(--on-surface)]">
                  {c.body}
                </p>
              </li>
            ))
          )}
        </ul>

        {access.canComment ? (
          <div className="space-y-2 rounded-xl border border-[var(--outline-variant)] p-3">
            {isGuest ? (
              <Input
                placeholder="Your name"
                value={guestLabel}
                onChange={(e) => setGuestLabel(e.target.value)}
              />
            ) : null}
            <Textarea
              placeholder="Leave feedback…"
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
              rows={3}
            />
            <Button
              disabled={addComment.isPending || !commentBody.trim()}
              onClick={() => void submitComment()}
            >
              {addComment.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Post comment
            </Button>
          </div>
        ) : (
          <p className="text-sm text-[var(--on-surface-variant)]">
            This session is closed to new comments.
          </p>
        )}
      </section>
    </div>
  );
}
