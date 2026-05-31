"use client";

import { use } from "react";

import { CollaborationSessionView } from "@/features/collaboration/session-view";

type Props = {
  params: Promise<{ id: string }>;
};

export default function CollaborationSessionPage({ params }: Props) {
  const { id } = use(params);
  return <CollaborationSessionView sessionId={id} />;
}
