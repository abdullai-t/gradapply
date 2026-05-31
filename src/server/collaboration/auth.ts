import type {
  CollaborationGuestInvite,
  CollaborationMember,
  CollaborationSession,
} from "@prisma/client";

import {
  collabGuestTokenFromRequest,
  hashCollabGuestToken,
} from "@/lib/collab-tokens";
import { getDb } from "@/lib/prisma";

export type SessionAccess =
  | {
      kind: "owner";
      session: CollaborationSession;
      userId: string;
    }
  | {
      kind: "member";
      session: CollaborationSession;
      userId: string;
      role: CollaborationMember["role"];
    }
  | {
      kind: "guest";
      session: CollaborationSession;
      invite: CollaborationGuestInvite;
      guestLabel: string | null;
    };

export async function resolveSessionAccess(
  req: Request,
  sessionId: string,
  userId?: string | null,
): Promise<SessionAccess | null> {
  const session = await getDb().collaborationSession.findUnique({
    where: { id: sessionId },
  });
  if (!session) return null;

  if (userId) {
    if (session.ownerId === userId) {
      return { kind: "owner", session, userId };
    }
    const member = await getDb().collaborationMember.findUnique({
      where: {
        sessionId_userId: { sessionId, userId },
      },
    });
    if (member) {
      return {
        kind: "member",
        session,
        userId,
        role: member.role,
      };
    }
  }

  const token = collabGuestTokenFromRequest(req);
  if (!token) return null;

  const tokenHash = hashCollabGuestToken(token);
  const invite = await getDb().collaborationGuestInvite.findFirst({
    where: {
      sessionId,
      tokenHash,
      revokedAt: null,
    },
  });
  if (!invite) return null;
  if (invite.expiresAt && invite.expiresAt < new Date()) return null;

  return {
    kind: "guest",
    session,
    invite,
    guestLabel: invite.label,
  };
}

export function canComment(access: SessionAccess): boolean {
  if (access.session.status === "CLOSED") return false;
  if (access.kind === "guest") return true;
  return true;
}

export function canManageSession(access: SessionAccess): boolean {
  return access.kind === "owner";
}

export function canEditLive(access: SessionAccess): boolean {
  if (access.session.status === "CLOSED") return false;
  if (access.kind === "owner") return true;
  if (access.kind === "member") return access.role === "EDITOR";
  return false;
}

export function serializeSessionForClient(
  session: CollaborationSession & {
    owner: { name: string | null };
    artifacts: { id: string; type: string; snapshot: unknown; version: number; createdAt: Date }[];
    members: {
      id: string;
      role: string;
      user: { id: string; name: string | null; email: string | null };
      joinedAt: Date | null;
    }[];
    comments: {
      id: string;
      body: string;
      parentId: string | null;
      guestLabel: string | null;
      createdAt: Date;
      author: { id: string; name: string | null } | null;
    }[];
  },
) {
  const latestArtifact = session.artifacts[0] ?? null;
  return {
    id: session.id,
    title: session.title,
    status: session.status,
    ownerName: session.owner.name,
    schoolId: session.schoolId,
    liveEnabled: session.liveEnabled,
    liveRoomId: session.liveRoomId,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    artifact: latestArtifact
      ? {
          id: latestArtifact.id,
          type: latestArtifact.type,
          snapshot: latestArtifact.snapshot,
          version: latestArtifact.version,
          createdAt: latestArtifact.createdAt,
        }
      : null,
    members: session.members.map((m) => ({
      id: m.id,
      role: m.role,
      name: m.user.name,
      email: m.user.email,
      joinedAt: m.joinedAt,
    })),
    comments: session.comments.map((c) => ({
      id: c.id,
      body: c.body,
      parentId: c.parentId,
      guestLabel: c.guestLabel,
      authorName: c.author?.name ?? null,
      createdAt: c.createdAt,
    })),
  };
}

export const sessionDetailInclude = {
  owner: { select: { name: true } },
  artifacts: {
    orderBy: { version: "desc" as const },
    take: 1,
    select: {
      id: true,
      type: true,
      snapshot: true,
      version: true,
      createdAt: true,
      sourceEntityId: true,
    },
  },
  members: {
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  },
  comments: {
    orderBy: { createdAt: "asc" as const },
    include: {
      author: { select: { id: true, name: true } },
    },
  },
} as const;
