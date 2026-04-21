import { ContentEntityType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import {
  documentTypeToEntityType,
  serializeProfEmailSnapshot,
} from "@/lib/content-version";
import { requireNonFreeForFeature } from "@/lib/plan-gates";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  entityType: z.nativeEnum(ContentEntityType),
  entityId: z.string().min(1).nullable().optional(),
  label: z.string().min(1).max(500),
  parentVersionId: z.string().nullable().optional(),
  /** Professor email — overrides DB when saving an unsaved draft. */
  emailSubject: z.string().nullable().optional(),
  emailBody: z.string().nullable().optional(),
  /** Freeform text snapshot (SOP paragraph, notes, etc.). */
  body: z.string().nullable().optional(),
  /** Explicit file URL (optional; otherwise derived from Document). */
  fileUrl: z.string().url().nullable().optional(),
});

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const locked = await requireNonFreeForFeature(session.user.id, "documents");
  if (locked) return locked;

  const { searchParams } = new URL(req.url);
  const entityTypeRaw = searchParams.get("entityType");
  const entityId = searchParams.get("entityId");

  if (!entityTypeRaw || entityTypeRaw === "") {
    return NextResponse.json(
      { error: "entityType query parameter is required." },
      { status: 400 },
    );
  }

  const entityTypeParsed = z
    .nativeEnum(ContentEntityType)
    .safeParse(entityTypeRaw);
  if (!entityTypeParsed.success)
    return NextResponse.json({ error: "Invalid entityType." }, { status: 400 });

  const entityType = entityTypeParsed.data;

  const where =
    entityId != null && entityId !== ""
      ? {
          userId: session.user.id,
          entityType,
          entityId,
        }
      : {
          userId: session.user.id,
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

  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const locked = await requireNonFreeForFeature(session.user.id, "documents");
  if (locked) return locked;

  const json = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

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
      return NextResponse.json(
        { error: "entityId is required for PROF_EMAIL snapshots." },
        { status: 400 },
      );
    }
    const row = await prisma.profEmail.findFirst({
      where: { id: entityId, userId: session.user.id },
    });
    if (!row)
      return NextResponse.json({ error: "Professor email not found." }, { status: 404 });

    body = serializeProfEmailSnapshot({
      emailSubject:
        overrideSubject !== undefined ? overrideSubject : row.emailSubject,
      emailBody: overrideBody !== undefined ? overrideBody : row.emailBody,
    });
  } else if (entityType === "SOP" || entityType === "CV") {
    if (!entityId) {
      return NextResponse.json(
        { error: "entityId (document id) is required for file snapshots." },
        { status: 400 },
      );
    }
    const doc = await prisma.document.findFirst({
      where: { id: entityId, userId: session.user.id },
    });
    if (!doc)
      return NextResponse.json({ error: "Document not found." }, { status: 404 });

    const mapped = documentTypeToEntityType(doc.type);
    if (mapped !== entityType) {
      return NextResponse.json(
        {
          error: `Document type "${doc.type}" does not match entityType "${entityType}".`,
        },
        { status: 400 },
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
        where: { id: entityId, userId: session.user.id },
      });
      if (!doc)
        return NextResponse.json({ error: "Document not found." }, { status: 404 });
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
      return NextResponse.json(
        {
          error:
            "Provide body text, entityId for a library file, or a fileUrl.",
        },
        { status: 400 },
      );
    }
  }

  if (parentVersionId) {
    const parent = await prisma.contentVersion.findFirst({
      where: {
        id: parentVersionId,
        userId: session.user.id,
      },
    });
    if (!parent)
      return NextResponse.json({ error: "Parent version not found." }, { status: 404 });
  }

  const row = await prisma.contentVersion.create({
    data: {
      userId: session.user.id,
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

  return NextResponse.json(row);
}
