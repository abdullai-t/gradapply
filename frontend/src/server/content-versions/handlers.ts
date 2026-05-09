import {
  documentTypeToEntityType,
  serializeProfEmailSnapshot,
} from "@/lib/content-version";
import { prisma } from "@/lib/prisma";
import { parseProfEmailSnapshot } from "@/lib/prof-email-version";

import { bad, notFound, ok } from "../_responses";
import { withPlanGate } from "../_with-plan-gate";

import { createContentVersionSchema, entityTypeSchema } from "./schemas";

export const list = withPlanGate("documents", async (req, { userId }) => {
  const { searchParams } = new URL(req.url);
  const entityTypeRaw = searchParams.get("entityType");
  const entityId = searchParams.get("entityId");

  if (!entityTypeRaw || entityTypeRaw === "") {
    return bad("entityType query parameter is required.");
  }

  const entityTypeParsed = entityTypeSchema.safeParse(entityTypeRaw);
  if (!entityTypeParsed.success) return bad("Invalid entityType.");

  const entityType = entityTypeParsed.data;

  const where =
    entityId != null && entityId !== ""
      ? {
          userId,
          entityType,
          entityId,
        }
      : {
          userId,
          entityType,
          entityId: null as null,
        };

  const rows = await prisma.contentVersion.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      entityType: true,
      entityId: true,
      label: true,
      body: true,
      fileUrl: true,
      createdAt: true,
      parentVersionId: true,
    },
  });

  return ok(rows);
});

export const create = withPlanGate("documents", async (req, { userId }) => {
  const json = await req.json().catch(() => null);
  const parsed = createContentVersionSchema.safeParse(json);
  if (!parsed.success) return bad({ error: parsed.error.flatten() });

  const {
    entityType,
    entityId: rawEntityId,
    label,
    parentVersionId,
    emailSubject: overrideSubject,
    emailBody: overrideBody,
    body: bodyOverride,
    fileUrl: explicitFileUrl,
  } = parsed.data;

  const entityId = rawEntityId ?? null;

  let body: string | null = null;
  let fileUrl: string | null = explicitFileUrl ?? null;

  if (entityType === "PROF_EMAIL") {
    if (!entityId) {
      return bad("entityId is required for PROF_EMAIL snapshots.");
    }
    const row = await prisma.profEmail.findFirst({
      where: { id: entityId, userId },
    });
    if (!row) return notFound("Professor email not found.");

    body = serializeProfEmailSnapshot({
      emailSubject:
        overrideSubject !== undefined ? overrideSubject : row.emailSubject,
      emailBody: overrideBody !== undefined ? overrideBody : row.emailBody,
    });
  } else if (entityType === "SOP" || entityType === "CV") {
    if (!entityId) {
      return bad("entityId (document id) is required for file snapshots.");
    }
    const doc = await prisma.document.findFirst({
      where: { id: entityId, userId },
    });
    if (!doc) return notFound("Document not found.");

    const mapped = documentTypeToEntityType(doc.type);
    if (mapped !== entityType) {
      return bad(
        `Document type "${doc.type}" does not match entityType "${entityType}".`,
      );
    }
    fileUrl = explicitFileUrl ?? doc.url;
    body =
      bodyOverride ??
      JSON.stringify({
        documentId: doc.id,
        documentName: doc.name,
        documentType: doc.type,
      });
  } else {
    /** OTHER — free text, external file URL, or any document id (transcript, GRE, etc.). */
    if (bodyOverride != null && bodyOverride !== "") {
      body = bodyOverride;
      fileUrl = explicitFileUrl ?? null;
    } else if (entityId) {
      const doc = await prisma.document.findFirst({
        where: { id: entityId, userId },
      });
      if (!doc) return notFound("Document not found.");
      fileUrl = explicitFileUrl ?? doc.url;
      body = JSON.stringify({
        documentId: doc.id,
        documentName: doc.name,
        documentType: doc.type,
      });
    } else if (explicitFileUrl) {
      body = bodyOverride ?? JSON.stringify({ kind: "external_file" });
      fileUrl = explicitFileUrl;
    } else {
      return bad(
        "Provide body text, entityId for a library file, or a fileUrl.",
      );
    }
  }

  if (parentVersionId) {
    const parent = await prisma.contentVersion.findFirst({
      where: {
        id: parentVersionId,
        userId,
      },
    });
    if (!parent) return notFound("Parent version not found.");
  }

  const row = await prisma.contentVersion.create({
    data: {
      userId,
      entityType,
      entityId,
      label,
      body,
      fileUrl,
      parentVersionId: parentVersionId ?? null,
    },
    select: {
      id: true,
      entityType: true,
      entityId: true,
      label: true,
      body: true,
      fileUrl: true,
      createdAt: true,
      parentVersionId: true,
    },
  });

  return ok(row);
});

export const get = withPlanGate<{ id: string }>(
  "documents",
  async (_req, { userId, params }) => {
    const row = await prisma.contentVersion.findFirst({
      where: { id: params.id, userId },
      select: {
        id: true,
        entityType: true,
        entityId: true,
        label: true,
        body: true,
        fileUrl: true,
        createdAt: true,
        parentVersionId: true,
      },
    });

    if (!row) return notFound("Not found.");

    return ok(row);
  },
);

/**
 * Applies a saved snapshot to the live draft. For professor email, updates
 * subject + body on the linked ProfEmail row.
 */
export const restore = withPlanGate<{ id: string }>(
  "documents",
  async (_req, { userId, params }) => {
    const version = await prisma.contentVersion.findFirst({
      where: { id: params.id, userId },
    });

    if (!version) return notFound("Version not found.");

    if (version.entityType === "PROF_EMAIL") {
      if (!version.entityId) return bad("Version is missing entityId.");

      const snap = parseProfEmailSnapshot(version.body);
      if (!snap) return bad("Could not parse email snapshot.");

      const prof = await prisma.profEmail.findFirst({
        where: { id: version.entityId, userId },
      });
      if (!prof) return notFound("Professor email not found.");

      const updated = await prisma.profEmail.update({
        where: { id: prof.id },
        data: {
          emailSubject: snap.emailSubject,
          emailBody: snap.emailBody,
        },
      });

      return ok({ ok: true, profEmail: updated });
    }

    return bad(
      "Restore is only supported for professor email snapshots in this release. Re-upload files from the library for document history.",
    );
  },
);
