import type { GoogleDocLink, GoogleDocLinkEntityType } from "@prisma/client";

import { getDb } from "@/lib/prisma";

import { plainTitleFromBody } from "./convert";

export type WriteupContent = {
  title: string;
  htmlBody: string;
  updatedAt: Date;
};

export async function loadWriteupContent(
  userId: string,
  entityType: GoogleDocLinkEntityType,
  entityId: string,
): Promise<WriteupContent> {
  const db = getDb();

  if (entityType === "SOP_VARIANT") {
    const row = await db.sopVariant.findFirst({
      where: { id: entityId, userId },
      include: { school: { select: { name: true, program: true } } },
    });
    if (!row) throw new Error("not_found");
    const title = `SOP — ${row.school.name}`;
    return {
      title,
      htmlBody: row.body,
      updatedAt: row.updatedAt,
    };
  }

  if (entityType === "PROF_EMAIL") {
    const row = await db.profEmail.findFirst({
      where: { id: entityId, userId },
    });
    if (!row) throw new Error("not_found");
    const subject = row.emailSubject?.trim() || "Professor email";
    const body = row.emailBody?.trim() ?? "";
    const htmlBody = body.includes("<") ? body : `<p>${body.replace(/\n/g, "</p><p>")}</p>`;
    return {
      title: plainTitleFromBody(subject, "Professor email"),
      htmlBody,
      updatedAt: row.updatedAt,
    };
  }

  if (entityType === "COLLABORATION_SESSION") {
    const session = await db.collaborationSession.findFirst({
      where: { id: entityId, ownerId: userId },
      include: {
        artifacts: { orderBy: { version: "desc" }, take: 1 },
      },
    });
    if (!session) throw new Error("not_found");
    const snap = session.artifacts[0]?.snapshot as
      | { body?: string; title?: string; emailSubject?: string }
      | undefined;
    const body = snap?.body ?? "";
    return {
      title: session.title,
      htmlBody: body,
      updatedAt: session.updatedAt,
    };
  }

  if (entityType === "DOCUMENT_TEXT") {
    const row = await db.document.findFirst({
      where: { id: entityId, userId },
    });
    if (!row) throw new Error("not_found");
    if (row.type !== "sop_draft" && row.type !== "other") {
      throw new Error("document_not_text");
    }
    throw new Error("document_requires_extract");
  }

  throw new Error("unsupported_entity");
}

export async function applyWriteupContent(
  userId: string,
  entityType: GoogleDocLinkEntityType,
  entityId: string,
  htmlBody: string,
): Promise<Date> {
  const db = getDb();
  const now = new Date();

  if (entityType === "SOP_VARIANT") {
    const row = await db.sopVariant.updateMany({
      where: { id: entityId, userId },
      data: { body: htmlBody, updatedAt: now },
    });
    if (row.count === 0) throw new Error("not_found");
    return now;
  }

  if (entityType === "PROF_EMAIL") {
    const row = await db.profEmail.updateMany({
      where: { id: entityId, userId },
      data: { emailBody: htmlBody, updatedAt: now },
    });
    if (row.count === 0) throw new Error("not_found");
    return now;
  }

  if (entityType === "COLLABORATION_SESSION") {
    const session = await db.collaborationSession.findFirst({
      where: { id: entityId, ownerId: userId },
      include: {
        artifacts: { orderBy: { version: "desc" }, take: 1 },
      },
    });
    if (!session) throw new Error("not_found");
    const latest = session.artifacts[0];
    if (!latest) throw new Error("no_artifact");

    const snap = latest.snapshot as Record<string, unknown>;
    const nextSnap = { ...snap, body: htmlBody };

    await db.$transaction([
      db.collaborationArtifact.create({
        data: {
          sessionId: entityId,
          type: latest.type,
          sourceEntityId: latest.sourceEntityId,
          snapshot: nextSnap,
          version: latest.version + 1,
        },
      }),
      db.collaborationSession.update({
        where: { id: entityId },
        data: { updatedAt: now },
      }),
    ]);

    if (latest.sourceEntityId && latest.type === "SOP_VARIANT") {
      await db.sopVariant.updateMany({
        where: { id: latest.sourceEntityId, userId },
        data: { body: htmlBody, updatedAt: now },
      });
    }
    if (latest.sourceEntityId && latest.type === "PROF_EMAIL") {
      await db.profEmail.updateMany({
        where: { id: latest.sourceEntityId, userId },
        data: { emailBody: htmlBody, updatedAt: now },
      });
    }

    return now;
  }

  throw new Error("unsupported_entity");
}

export function serializeLink(link: GoogleDocLink) {
  return {
    id: link.id,
    entityType: link.entityType,
    entityId: link.entityId,
    googleDocUrl: link.googleDocUrl,
    lastSyncedAt: link.lastSyncedAt,
    lastSyncSource: link.lastSyncSource,
    lastSyncError: link.lastSyncError,
    watchExpiresAt: link.watchExpiresAt,
  };
}
