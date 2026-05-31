"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as
      | { error?: string }
      | null;
    throw new Error(body?.error ?? `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

export type CollaborationSessionSummary = {
  id: string;
  title: string;
  status: string;
  ownerName: string | null;
  isOwner: boolean;
  liveEnabled: boolean;
  updatedAt: string;
  commentCount: number;
  memberCount: number;
  artifactType: string | null;
};

export type ArtifactSnapshot = {
  body: string;
  title?: string;
  emailSubject?: string;
  profName?: string;
};

export type CollaborationSessionDetail = {
  id: string;
  title: string;
  status: string;
  ownerName: string | null;
  schoolId: string | null;
  liveEnabled: boolean;
  liveRoomId: string | null;
  createdAt: string;
  updatedAt: string;
  artifact: {
    id: string;
    type: string;
    snapshot: ArtifactSnapshot;
    version: number;
    createdAt: string;
  } | null;
  members: {
    id: string;
    role: string;
    name: string | null;
    email: string | null;
    joinedAt: string | null;
  }[];
  comments: {
    id: string;
    body: string;
    parentId: string | null;
    guestLabel: string | null;
    authorName: string | null;
    createdAt: string;
  }[];
};

export const collaborationKeys = {
  all: ["collaboration"] as const,
  list: () => [...collaborationKeys.all, "list"] as const,
  detail: (id: string) => [...collaborationKeys.all, "detail", id] as const,
  guest: (token: string) => [...collaborationKeys.all, "guest", token] as const,
};

function guestHeaders(token?: string): HeadersInit {
  if (!token) return {};
  return { "X-Collab-Guest-Token": token };
}

export function useCollaborationSessions() {
  return useQuery({
    queryKey: collaborationKeys.list(),
    queryFn: async () =>
      jsonOrThrow<{ sessions: CollaborationSessionSummary[] }>(
        await fetch("/api/collaboration/sessions"),
      ),
  });
}

export function useCollaborationSession(
  sessionId: string,
  guestToken?: string,
) {
  return useQuery({
    queryKey: collaborationKeys.detail(sessionId),
    queryFn: async () =>
      jsonOrThrow<{
        session: CollaborationSessionDetail;
        access: {
          kind: string;
          role?: string;
          canManage: boolean;
          canComment: boolean;
        };
      }>(
        await fetch(`/api/collaboration/sessions/${sessionId}`, {
          headers: guestHeaders(guestToken),
        }),
      ),
    enabled: Boolean(sessionId),
  });
}

export function useGuestCollaborationSession(token: string) {
  return useQuery({
    queryKey: collaborationKeys.guest(token),
    queryFn: async () =>
      jsonOrThrow<{
        session: CollaborationSessionDetail;
        access: { kind: string; canComment: boolean; canManage: boolean };
      }>(await fetch(`/api/collaboration/guest/${token}`)),
    enabled: Boolean(token),
  });
}

export function useCreateCollaborationSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      artifactType: "SOP_VARIANT" | "PROF_EMAIL";
      entityId: string;
      title?: string;
    }) =>
      jsonOrThrow<{ session: CollaborationSessionDetail }>(
        await fetch("/api/collaboration/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: collaborationKeys.list() });
    },
  });
}

export function useInviteCollaborator(sessionId: string) {
  return useMutation({
    mutationFn: async (body: { email: string; role?: "COMMENTER" | "EDITOR" }) =>
      jsonOrThrow<{ invited: boolean }>(
        await fetch(`/api/collaboration/sessions/${sessionId}/invite`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
      ),
  });
}

export function useCreateGuestLink(sessionId: string) {
  return useMutation({
    mutationFn: async (body?: { label?: string; expiresInDays?: number }) =>
      jsonOrThrow<{
        inviteId: string;
        token: string;
        url: string;
        expiresAt: string | null;
      }>(
        await fetch(`/api/collaboration/sessions/${sessionId}/guest-link`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body ?? {}),
        }),
      ),
  });
}

export function useAddCollaborationComment(
  sessionId: string,
  guestToken?: string,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      body: string;
      parentId?: string;
      guestLabel?: string;
    }) =>
      jsonOrThrow<{ comment: CollaborationSessionDetail["comments"][0] }>(
        await fetch(`/api/collaboration/sessions/${sessionId}/comments`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...guestHeaders(guestToken),
          },
          body: JSON.stringify(body),
        }),
      ),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: collaborationKeys.detail(sessionId),
      });
      if (guestToken) {
        void qc.invalidateQueries({
          queryKey: collaborationKeys.guest(guestToken),
        });
      }
    },
  });
}

export function useRefreshCollaborationArtifact(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () =>
      jsonOrThrow(
        await fetch(
          `/api/collaboration/sessions/${sessionId}/artifacts/refresh`,
          { method: "POST" },
        ),
      ),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: collaborationKeys.detail(sessionId),
      });
    },
  });
}

export function useUpdateCollaborationSession(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      status?: "OPEN" | "CLOSED";
      title?: string;
      liveEnabled?: boolean;
    }) =>
      jsonOrThrow<{ session: CollaborationSessionDetail }>(
        await fetch(`/api/collaboration/sessions/${sessionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
      ),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: collaborationKeys.detail(sessionId),
      });
      void qc.invalidateQueries({ queryKey: collaborationKeys.list() });
    },
  });
}

export function usePersistLiveSop(sessionId: string) {
  return useMutation({
    mutationFn: async (body: string) =>
      jsonOrThrow<{ persisted: boolean }>(
        await fetch(`/api/collaboration/sessions/${sessionId}/persist-live`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body }),
        }),
      ),
  });
}
