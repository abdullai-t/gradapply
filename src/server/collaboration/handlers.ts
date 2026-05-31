import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { appOrigin } from "@/lib/app-origin";
import {
  generateCollabGuestToken,
  hashCollabGuestToken,
} from "@/lib/collab-tokens";
import { assertGuestCommentAllowed } from "@/lib/collab-guest-rate-limit";
import {
  requireCollaborationCreate,
  requireCollaborationFeature,
} from "@/lib/collaboration-gates";
import { notifyInBackground } from "@/lib/notifications/send";
import { sendCollabInviteEmail } from "@/lib/notifications/collab-invite";
import { getDb } from "@/lib/prisma";
import { requireWritableAccount } from "@/lib/plan-gates";
import { bad, forbidden, notFound, ok } from "@/server/_responses";
import { withAuth } from "@/server/_with-auth";

import {
  canComment,
  canManageSession,
  resolveSessionAccess,
  serializeSessionForClient,
  sessionDetailInclude,
} from "./auth";
import {
  createCommentSchema,
  createGuestLinkSchema,
  createSessionSchema,
  inviteMemberSchema,
  persistLiveBodySchema,
  revokeGuestLinkSchema,
  updateSessionSchema,
} from "./schemas";
import { buildArtifactSnapshot, refreshSnapshotFromSource } from "./snapshots";

export const listSessions = withAuth(async (_req, { userId }) => {
  const gate = await requireCollaborationFeature();
  if (gate) return gate;

  const sessions = await getDb().collaborationSession.findMany({
    where: {
      OR: [{ ownerId: userId }, { members: { some: { userId } } }],
    },
    orderBy: { updatedAt: "desc" },
    include: {
      owner: { select: { name: true } },
      artifacts: {
        orderBy: { version: "desc" },
        take: 1,
        select: { type: true, version: true, createdAt: true },
      },
      _count: { select: { comments: true, members: true } },
    },
  });

  return ok({
    sessions: sessions.map((s) => ({
      id: s.id,
      title: s.title,
      status: s.status,
      ownerName: s.owner.name,
      isOwner: s.ownerId === userId,
      liveEnabled: s.liveEnabled,
      updatedAt: s.updatedAt,
      commentCount: s._count.comments,
      memberCount: s._count.members + 1,
      artifactType: s.artifacts[0]?.type ?? null,
    })),
  });
});

export const createSession = withAuth(async (req, { userId }) => {
  let db;
  try {
    db = getDb();
  } catch (e) {
    const message = e instanceof Error ? e.message : "Database client not ready";
    return NextResponse.json({ error: message }, { status: 503 });
  }

  const gate = await requireCollaborationCreate(userId);
  if (gate) return gate;
  const readOnly = await requireWritableAccount(userId);
  if (readOnly) return readOnly;

  const json = await req.json().catch(() => null);
  const parsed = createSessionSchema.safeParse(json);
  if (!parsed.success) return bad({ error: parsed.error.flatten() });

  let built: Awaited<ReturnType<typeof buildArtifactSnapshot>>;
  try {
    built = await buildArtifactSnapshot({
      userId,
      artifactType: parsed.data.artifactType,
      entityId: parsed.data.entityId,
      customBody: parsed.data.customBody,
      customTitle: parsed.data.customTitle,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Invalid artifact";
    return bad(message);
  }

  const session = await db.collaborationSession.create({
    data: {
      ownerId: userId,
      title: parsed.data.title?.trim() || built.title,
      schoolId: built.schoolId,
      members: {
        create: {
          userId,
          role: "OWNER",
          joinedAt: new Date(),
        },
      },
      artifacts: {
        create: {
          type: parsed.data.artifactType,
          sourceEntityId: built.sourceEntityId,
          snapshot: built.snapshot,
          version: 1,
        },
      },
    },
    include: sessionDetailInclude,
  });

  return ok({ session: serializeSessionForClient(session) }, { status: 201 });
});

export const getSession = async (
  req: Request,
  routeCtx: { params: Promise<{ id: string }> },
) => {
  const gate = await requireCollaborationFeature();
  if (gate) return gate;

  const { id } = await routeCtx.params;
  const sessionAuth = await auth();
  const userId = sessionAuth?.user?.id ?? null;
  const access = await resolveSessionAccess(req, id, userId);
  if (!access) return notFound("Review session not found");

  const full = await getDb().collaborationSession.findUnique({
    where: { id },
    include: sessionDetailInclude,
  });
  if (!full) return notFound("Review session not found");

  return ok({
    session: serializeSessionForClient(full),
    access: {
      kind: access.kind,
      role: access.kind === "member" ? access.role : undefined,
      canManage: canManageSession(access),
      canComment: canComment(access),
    },
  });
};

export const updateSession = withAuth(async (req, { userId, params }) => {
  const gate = await requireCollaborationFeature();
  if (gate) return gate;

  const access = await resolveSessionAccess(req, params.id, userId);
  if (!access || !canManageSession(access)) {
    return forbidden("Only the session owner can update this session");
  }

  const json = await req.json().catch(() => null);
  const parsed = updateSessionSchema.safeParse(json);
  if (!parsed.success) return bad({ error: parsed.error.flatten() });

  const liveRoomId =
    parsed.data.liveEnabled === true
      ? `collab:${params.id}`
      : parsed.data.liveEnabled === false
        ? null
        : undefined;

  const updated = await getDb().collaborationSession.update({
    where: { id: params.id },
    data: {
      ...(parsed.data.status ? { status: parsed.data.status } : {}),
      ...(parsed.data.title ? { title: parsed.data.title } : {}),
      ...(parsed.data.liveEnabled !== undefined
        ? { liveEnabled: parsed.data.liveEnabled }
        : {}),
      ...(liveRoomId !== undefined ? { liveRoomId } : {}),
    },
    include: sessionDetailInclude,
  });

  return ok({ session: serializeSessionForClient(updated) });
});

export const inviteMember = withAuth(async (req, { userId, params }) => {
  const gate = await requireCollaborationCreate(userId);
  if (gate) return gate;

  const access = await resolveSessionAccess(req, params.id, userId);
  if (!access || !canManageSession(access)) {
    return forbidden("Only the session owner can invite collaborators");
  }

  const json = await req.json().catch(() => null);
  const parsed = inviteMemberSchema.safeParse(json);
  if (!parsed.success) return bad({ error: parsed.error.flatten() });

  const email = parsed.data.email.trim().toLowerCase();
  const invitee = await getDb().user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true },
  });
  if (!invitee) {
    return bad(
      "No GradApply account found for that email. Use a guest link instead.",
    );
  }
  if (invitee.id === userId) {
    return bad("You cannot invite yourself");
  }

  await getDb().collaborationMember.upsert({
    where: {
      sessionId_userId: { sessionId: params.id, userId: invitee.id },
    },
    create: {
      sessionId: params.id,
      userId: invitee.id,
      role: parsed.data.role,
      joinedAt: new Date(),
    },
    update: {
      role: parsed.data.role,
    },
  });

  const owner = await getDb().user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  });

  notifyInBackground("collab_invite", () =>
    sendCollabInviteEmail({
      invitee: {
        id: invitee.id,
        email: invitee.email,
        name: invitee.name,
      },
      ownerName: owner?.name ?? owner?.email ?? "A scholar",
      sessionTitle: access.session.title,
      sessionId: params.id,
    }),
  );

  const gdoc = await getDb().googleDocLink.findUnique({
    where: {
      entityType_entityId: {
        entityType: "COLLABORATION_SESSION",
        entityId: params.id,
      },
    },
  });
  if (gdoc && invitee.email) {
    try {
      const { shareGoogleDocWithEmail } = await import(
        "@/lib/google-docs/permissions"
      );
      await shareGoogleDocWithEmail({
        userId,
        fileId: gdoc.googleFileId,
        email: invitee.email,
      });
    } catch {
      /* non-fatal — in-app access still works */
    }
  }

  return ok({ invited: true, userId: invitee.id });
});

export const createGuestLink = withAuth(async (req, { userId, params }) => {
  const gate = await requireCollaborationCreate(userId);
  if (gate) return gate;

  const access = await resolveSessionAccess(req, params.id, userId);
  if (!access || !canManageSession(access)) {
    return forbidden("Only the session owner can create guest links");
  }

  const json = await req.json().catch(() => null);
  const parsed = createGuestLinkSchema.safeParse(json);
  if (!parsed.success) return bad({ error: parsed.error.flatten() });

  const token = generateCollabGuestToken();
  const tokenHash = hashCollabGuestToken(token);
  const expiresAt = parsed.data.expiresInDays
    ? new Date(Date.now() + parsed.data.expiresInDays * 86_400_000)
    : null;

  const invite = await getDb().collaborationGuestInvite.create({
    data: {
      sessionId: params.id,
      tokenHash,
      label: parsed.data.label?.trim() || null,
      expiresAt,
    },
  });

  const origin = appOrigin();
  return ok({
    inviteId: invite.id,
    token,
    url: `${origin}/collaborate/${token}`,
    expiresAt,
  });
});

export const revokeGuestLink = withAuth(async (req, { userId, params }) => {
  const gate = await requireCollaborationCreate(userId);
  if (gate) return gate;

  const access = await resolveSessionAccess(req, params.id, userId);
  if (!access || !canManageSession(access)) {
    return forbidden("Only the session owner can revoke guest links");
  }

  const json = await req.json().catch(() => null);
  const parsed = revokeGuestLinkSchema.safeParse(json);
  if (!parsed.success) return bad({ error: parsed.error.flatten() });

  await getDb().collaborationGuestInvite.updateMany({
    where: { id: parsed.data.inviteId, sessionId: params.id },
    data: { revokedAt: new Date() },
  });

  return ok({ revoked: true });
});

export const refreshArtifact = withAuth(async (req, { userId, params }) => {
  const gate = await requireCollaborationCreate(userId);
  if (gate) return gate;
  const readOnly = await requireWritableAccount(userId);
  if (readOnly) return readOnly;

  const access = await resolveSessionAccess(req, params.id, userId);
  if (!access || !canManageSession(access)) {
    return forbidden("Only the session owner can refresh the snapshot");
  }

  const latest = await getDb().collaborationArtifact.findFirst({
    where: { sessionId: params.id },
    orderBy: { version: "desc" },
  });
  if (!latest) return notFound("No artifact on this session");

  let snapshot: Awaited<ReturnType<typeof refreshSnapshotFromSource>>;
  try {
    snapshot = await refreshSnapshotFromSource({
      userId,
      artifactType: latest.type,
      sourceEntityId: latest.sourceEntityId,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Refresh failed";
    return bad(message);
  }

  const artifact = await getDb().collaborationArtifact.create({
    data: {
      sessionId: params.id,
      type: latest.type,
      sourceEntityId: latest.sourceEntityId,
      snapshot,
      version: latest.version + 1,
    },
  });

  await getDb().collaborationSession.update({
    where: { id: params.id },
    data: { updatedAt: new Date() },
  });

  const { schedulePushToGoogle } = await import("@/lib/google-docs/push-hook");
  schedulePushToGoogle(userId, "COLLABORATION_SESSION", params.id);

  return ok({
    artifact: {
      id: artifact.id,
      type: artifact.type,
      snapshot: artifact.snapshot,
      version: artifact.version,
      createdAt: artifact.createdAt,
    },
  });
});

export const listComments = async (
  req: Request,
  routeCtx: { params: Promise<{ id: string }> },
) => {
  const gate = await requireCollaborationFeature();
  if (gate) return gate;

  const { id } = await routeCtx.params;
  const sessionAuth = await auth();
  const userId = sessionAuth?.user?.id ?? null;
  const access = await resolveSessionAccess(req, id, userId);
  if (!access) return notFound("Review session not found");

  const comments = await getDb().collaborationComment.findMany({
    where: { sessionId: id },
    orderBy: { createdAt: "asc" },
    include: { author: { select: { id: true, name: true } } },
  });

  return ok({
    comments: comments.map((c) => ({
      id: c.id,
      body: c.body,
      parentId: c.parentId,
      guestLabel: c.guestLabel,
      authorName: c.author?.name ?? null,
      createdAt: c.createdAt,
    })),
  });
};

export const createComment = async (
  req: Request,
  routeCtx: { params: Promise<{ id: string }> },
) => {
  const gate = await requireCollaborationFeature();
  if (gate) return gate;

  const { id } = await routeCtx.params;
  const sessionAuth = await auth();
  const userId = sessionAuth?.user?.id ?? null;
  const access = await resolveSessionAccess(req, id, userId);
  if (!access) return notFound("Review session not found");
  if (!canComment(access)) {
    return bad("This review session is closed");
  }

  if (access.kind === "guest") {
    const cap = await assertGuestCommentAllowed(id);
    if (!cap.ok) {
      return NextResponse.json(
        { error: "Too many comments. Please try again later." },
        { status: 429, headers: { RetryAfter: String(cap.retryAfterSec) } },
      );
    }
  }

  const json = await req.json().catch(() => null);
  const parsed = createCommentSchema.safeParse(json);
  if (!parsed.success) return bad({ error: parsed.error.flatten() });

  if (access.kind === "guest" && !parsed.data.guestLabel?.trim()) {
    return bad("guestLabel is required for guest commenters");
  }

  const comment = await getDb().collaborationComment.create({
    data: {
      sessionId: id,
      body: parsed.data.body.trim(),
      parentId: parsed.data.parentId ?? null,
      authorUserId: access.kind === "guest" ? null : access.userId,
      guestLabel:
        access.kind === "guest"
          ? parsed.data.guestLabel?.trim() || access.guestLabel
          : null,
    },
    include: { author: { select: { id: true, name: true } } },
  });

  await getDb().collaborationSession.update({
    where: { id },
    data: { updatedAt: new Date() },
  });

  return ok(
    {
      comment: {
        id: comment.id,
        body: comment.body,
        parentId: comment.parentId,
        guestLabel: comment.guestLabel,
        authorName: comment.author?.name ?? null,
        createdAt: comment.createdAt,
      },
    },
    { status: 201 },
  );
};

/** Resolve guest token to session id (public, no session body leak beyond id). */
export const resolveGuestToken = async (
  req: Request,
  routeCtx: { params: Promise<{ token: string }> },
) => {
  const gate = await requireCollaborationFeature();
  if (gate) return gate;

  const { token } = await routeCtx.params;
  const tokenHash = hashCollabGuestToken(token);
  const invite = await getDb().collaborationGuestInvite.findFirst({
    where: { tokenHash, revokedAt: null },
    include: {
      session: {
        include: sessionDetailInclude,
      },
    },
  });

  if (!invite) return notFound("Invalid or expired link");
  if (invite.expiresAt && invite.expiresAt < new Date()) {
    return notFound("This link has expired");
  }

  const res = ok({
    session: serializeSessionForClient(invite.session),
    access: {
      kind: "guest" as const,
      canComment: invite.session.status === "OPEN",
      canManage: false,
    },
  });
  res.headers.set(
    "Set-Cookie",
    `collab_guest=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}`,
  );
  return res;
};

export const persistLiveBody = withAuth(async (req, { userId, params }) => {
  const gate = await requireCollaborationFeature();
  if (gate) return gate;
  const readOnly = await requireWritableAccount(userId);
  if (readOnly) return readOnly;

  const access = await resolveSessionAccess(req, params.id, userId);
  if (!access || access.kind !== "owner") {
    return forbidden("Only the owner can persist live session edits");
  }

  const latest = await getDb().collaborationArtifact.findFirst({
    where: { sessionId: params.id },
    orderBy: { version: "desc" },
  });
  if (!latest || latest.type !== "SOP_VARIANT" || !latest.sourceEntityId) {
    return bad("Live persist is only supported for SOP variant sessions");
  }

  const json = await req.json().catch(() => null);
  const parsed = persistLiveBodySchema.safeParse(json);
  if (!parsed.success) return bad({ error: parsed.error.flatten() });

  await getDb().sopVariant.updateMany({
    where: { id: latest.sourceEntityId, userId },
    data: { body: parsed.data.body },
  });

  return ok({ persisted: true });
});
