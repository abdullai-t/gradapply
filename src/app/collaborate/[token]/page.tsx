"use client";

import { use } from "react";

import { CollaborationSessionView } from "@/features/collaboration/session-view";
import { useGuestCollaborationSession } from "@/features/collaboration/api";
import { PageLoader } from "@/components/page-loader";

type Props = {
  params: Promise<{ token: string }>;
};

export default function GuestCollaboratePage({ params }: Props) {
  const { token } = use(params);
  const guestQuery = useGuestCollaborationSession(token);

  if (guestQuery.isLoading) return <PageLoader />;

  const sessionId = guestQuery.data?.session.id;
  if (!sessionId) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center text-sm text-[var(--on-surface-variant)]">
        This review link is invalid or has expired.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--surface)] px-4 py-8">
      <CollaborationSessionView
        sessionId={sessionId}
        guestToken={token}
        backHref="/"
      />
    </div>
  );
}
