import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { PlanTier } from "@prisma/client";

import { destroyStoredAsset, isCloudinaryConfigured, uploadDocumentBuffer } from "@/lib/cloudinary";
import {
  extractPlainTextFromStoredDocument,
  getStoredDocumentExtractionStatus,
} from "@/lib/llm-user-context";
import { getUserPlanTier } from "@/lib/plan-gates";
import { prisma } from "@/lib/prisma";
import {
  deleteObject,
  getBucketName,
  isS3UploadConfigured,
  uploadObject,
} from "@/lib/s3";

import { bad, notFound, ok } from "../_responses";
import { withPlanGate } from "../_with-plan-gate";

import {
  createDocumentSchema,
  patchDocumentSchema,
  uploadKindSchema,
} from "./schemas";

const DOC_STORAGE_LIMIT_BYTES: Record<PlanTier, number> = {
  FREE: 10 * 1024 * 1024, // 10MB
  PLUS: 50 * 1024 * 1024, // 50MB
  PRO: 100 * 1024 * 1024, // 100MB
};
const MAX_SINGLE_UPLOAD_BYTES = 1 * 1024 * 1024; // 1MB

function storageLimitForPlan(planTier: PlanTier | null): number {
  if (!planTier) return DOC_STORAGE_LIMIT_BYTES.FREE;
  return DOC_STORAGE_LIMIT_BYTES[planTier];
}

async function enforceFreeTierStorageLimit(
  userId: string,
  incomingBytes: number,
): Promise<Response | null> {
  const planTier = await getUserPlanTier(userId);
  const limitBytes = storageLimitForPlan(planTier);

  const current = await prisma.document.aggregate({
    where: { userId },
    _sum: { size: true },
  });
  const usedBytes = current._sum.size ?? 0;
  const projectedBytes = usedBytes + Math.max(0, incomingBytes);

  if (projectedBytes <= limitBytes) return null;

  const tierLabel = planTier ?? "FREE";
  const limitMb = Math.round(limitBytes / (1024 * 1024));

  return bad(
    `${tierLabel} storage limit reached. You can store up to ${limitMb}MB of documents total (currently ${(usedBytes / (1024 * 1024)).toFixed(2)}MB). Remove files or upgrade your plan.`,
    402,
  );
}

/**
 * GET /api/documents
 *
 * Folder filter:
 *   ?folderId=<id>     — only docs in that folder
 *   ?folderId=none     — only uncategorized docs (folderId IS NULL)
 *   (omitted)          — all docs
 *
 * Pagination (B4):
 *   ?take=<int>        — page size (default 50, max 200)
 *   ?cursor=<docId>    — opaque cursor; pass back the last seen `id`
 *
 * Response shape: when `?take=` or `?cursor=` is supplied returns
 * `{ items, nextCursor }`. Otherwise returns the legacy unpaginated array
 * (preserved so existing callers — the v1 /documents page bootstrap — keep
 * working; Phase 6 will drop this branch).
 */
export const list = withPlanGate("documents", async (req, { userId }) => {
  const url = new URL(req.url);
  const supportsFolders = Boolean(
    (prisma as unknown as { folder?: unknown }).folder,
  );

  const folderParam = url.searchParams.get("folderId");
  const folderFilter =
    !supportsFolders
      ? {}
      : folderParam === "none"
      ? { folderId: null }
      : folderParam
        ? { folderId: folderParam }
        : {};

  const takeRaw = Number.parseInt(url.searchParams.get("take") ?? "", 10);
  const take =
    Number.isFinite(takeRaw) && takeRaw > 0 ? Math.min(takeRaw, 200) : 50;
  const cursor = url.searchParams.get("cursor");
  const paged = url.searchParams.has("take") || url.searchParams.has("cursor");

  if (paged) {
    const documents = await prisma.document.findMany({
      where: { userId, ...folderFilter },
      orderBy: { createdAt: "desc" },
      take: take + 1, // peek one ahead to detect more
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      ...(supportsFolders
        ? { include: { folder: { select: { id: true, name: true } } } }
        : {}),
    });
    const hasMore = documents.length > take;
    const items = hasMore ? documents.slice(0, take) : documents;
    return ok({
      items,
      nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null,
    });
  }

  // Legacy non-paginated response — preserved so existing callers (the v1
  // /documents page bootstrap) keep working.
  const documents = await prisma.document.findMany({
    where: { userId, ...folderFilter },
    orderBy: { createdAt: "desc" },
    ...(supportsFolders
      ? { include: { folder: { select: { id: true, name: true } } } }
      : {}),
  });

  return ok(documents);
});

/** POST /api/documents — create a document record (from a pre-uploaded URL). */
export const create = withPlanGate("documents", async (req, { userId }) => {
  const supportsFolders = Boolean(
    (prisma as unknown as { folder?: unknown }).folder,
  );
  const json = await req.json().catch(() => null);
  const parsed = createDocumentSchema.safeParse(json);
  if (!parsed.success) return bad(parsed.error.flatten());
  const { folderId, ...createDataWithoutFolder } = parsed.data;

  const sizeBytes = parsed.data.size ?? 0;
  const limitError = await enforceFreeTierStorageLimit(userId, sizeBytes);
  if (limitError) return limitError;

  // Verify folder ownership if one was provided.
  if (supportsFolders && folderId) {
    const folder = await prisma.folder.findFirst({
      where: { id: folderId, userId },
      select: { id: true },
    });
    if (!folder) return notFound("Folder not found");
  }

  const doc = await prisma.document.create({
    data: {
      ...(supportsFolders ? parsed.data : createDataWithoutFolder),
      userId,
    },
  });

  return ok(doc);
});

/** PATCH /api/documents/[id] — rename or move into/out of a folder. */
export const patch = withPlanGate<{ id: string }>(
  "documents",
  async (req, { userId, params }) => {
    const supportsFolders = Boolean(
      (prisma as unknown as { folder?: unknown }).folder,
    );
    const json = await req.json().catch(() => null);
    const parsed = patchDocumentSchema.safeParse(json);
    if (!parsed.success) return bad(parsed.error.flatten());

    const existing = await prisma.document.findFirst({
      where: { id: params.id, userId },
    });
    if (!existing) return notFound();

    // If moving into a folder, verify the folder belongs to this user.
    if (supportsFolders && parsed.data.folderId) {
      const folder = await prisma.folder.findFirst({
        where: { id: parsed.data.folderId, userId },
        select: { id: true },
      });
      if (!folder) return notFound("Folder not found");
    }

    const updated = await prisma.document.update({
      where: { id: params.id },
      data: {
        ...(supportsFolders && parsed.data.folderId !== undefined
          ? { folderId: parsed.data.folderId }
          : {}),
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      },
    });

    return ok(updated);
  },
);

/**
 * DELETE /api/documents/[id]
 *
 * Order matters: delete related ContentVersion rows first, then clean up the
 * remote storage asset (Cloudinary or S3), then delete the Document row.
 */
export const remove = withPlanGate<{ id: string }>(
  "documents",
  async (_req, { userId, params }) => {
    const { id } = params;

    const existing = await prisma.document.findFirst({
      where: { id, userId },
    });
    if (!existing) return notFound();

    await prisma.contentVersion.deleteMany({
      where: {
        userId,
        entityId: id,
      },
    });

    if (existing.s3Key) {
      if (isCloudinaryConfigured()) {
        await destroyStoredAsset(existing.s3Key);
      } else if (isS3UploadConfigured() && getBucketName()) {
        try {
          await deleteObject(existing.s3Key);
        } catch (e) {
          console.error(e);
        }
      }
    }

    await prisma.document.delete({ where: { id } });

    return ok({ ok: true });
  },
);

/**
 * GET /api/documents/summary
 *
 * Lightweight aggregation endpoint that backs the `/documents` page summary
 * tiles (StorageHealth, CategoryCards, FoldersBar counts) without forcing
 * the page to fetch every Document row up-front. Pairs with cursor-based
 * pagination on `GET /api/documents`.
 */
export const summary = withPlanGate("documents", async (_req, { userId }) => {
  const supportsFolders = Boolean(
    (prisma as unknown as { folder?: unknown }).folder,
  );
  const [groups, totalAgg, uncategorized] = await Promise.all([
    prisma.document.groupBy({
      by: ["type"],
      where: { userId },
      _count: { _all: true },
      _sum: { size: true },
    }),
    prisma.document.aggregate({
      where: { userId },
      _count: { _all: true },
      _sum: { size: true },
    }),
    supportsFolders
      ? prisma.document.count({ where: { userId, folderId: null } })
      : prisma.document.count({ where: { userId } }),
  ]);

  const byKind: Record<string, number> = {};
  for (const g of groups) byKind[g.type] = g._count._all;

  return ok({
    total: totalAgg._count._all,
    uncategorized,
    bytesUsed: totalAgg._sum.size ?? 0,
    byKind,
  });
});

/**
 * POST /api/documents/upload
 *
 * Multipart upload: `file` + `kind` (cv | transcript | gre | sop_draft | other).
 * Uses Cloudinary when `CLOUDINARY_URL` is set; otherwise falls back to S3
 * `uploadObject`.
 */
export const upload = withPlanGate("documents", async (req, { userId }) => {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return bad("Invalid form data");
  }

  const file = form.get("file");
  const kindRaw = form.get("kind");
  if (!(file instanceof File)) {
    return bad("Missing file");
  }

  const parsedKind = uploadKindSchema.safeParse(
    typeof kindRaw === "string" ? kindRaw : "",
  );
  if (!parsedKind.success) {
    return bad("Invalid document type");
  }

  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length > MAX_SINGLE_UPLOAD_BYTES) {
    return bad(
      `File too large. Maximum allowed upload size is 1MB (received ${(buf.length / (1024 * 1024)).toFixed(2)}MB).`,
      413,
    );
  }
  const limitError = await enforceFreeTierStorageLimit(userId, buf.length);
  if (limitError) return limitError;
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const mimeType = file.type || "application/octet-stream";

  if (!isCloudinaryConfigured() && !isS3UploadConfigured()) {
    return NextResponse.json(
      {
        error:
          "No file storage configured. Add CLOUDINARY_URL to .env (or CLOUDINARY_CLOUD_NAME + CLOUDINARY_API_KEY + CLOUDINARY_API_SECRET), or set up S3 (bucket + AWS_REGION + AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY). Restart `pnpm dev` after editing .env.",
      },
      { status: 503 },
    );
  }

  try {
    let url: string;
    let storageKey: string | null;

    if (isCloudinaryConfigured()) {
      const { secure_url, public_id } = await uploadDocumentBuffer(buf, {
        folder: `gradapply/users/${userId}`,
        filename: safeName,
      });
      url = secure_url;
      storageKey = public_id;
    } else {
      const key = `users/${userId}/${randomUUID()}-${safeName}`;
      url = await uploadObject({
        key,
        body: buf,
        contentType: mimeType,
      });
      storageKey = key;
    }

    const doc = await prisma.document.create({
      data: {
        userId,
        name: file.name,
        type: parsedKind.data,
        url,
        s3Key: storageKey,
        mimeType,
        size: buf.length,
      },
    });
    return ok(doc);
  } catch (e) {
    console.error(e);
    const msg = e instanceof Error ? e.message : "Upload failed";
    return bad(msg, 500);
  }
});

/** GET /api/documents/extraction-status — per-file extraction diagnostics. */
export const extractionStatus = withPlanGate(
  "documents",
  async (req, { userId }) => {
    const startedAt = Date.now();
    const url = new URL(req.url);
    const takeRaw = Number.parseInt(url.searchParams.get("take") ?? "", 10);
    const take =
      Number.isFinite(takeRaw) && takeRaw > 0 ? Math.min(takeRaw, 25) : 10;
    const docs = await prisma.document.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take,
      select: {
        id: true,
        name: true,
        url: true,
        s3Key: true,
        mimeType: true,
      },
    });

    const statuses = await Promise.all(
      docs.map(async (doc) => ({
        id: doc.id,
        name: doc.name,
        ...(await getStoredDocumentExtractionStatus({
          url: doc.url,
          s3Key: doc.s3Key,
          mimeType: doc.mimeType,
        })),
      })),
    );
    console.info("[perf][documents.extraction-status]", {
      userId,
      docs: docs.length,
      durationMs: Date.now() - startedAt,
    });
    return ok({ statuses });
  },
);

/** GET /api/documents/[id]/parsed-text — inspect extracted text for one file. */
export const parsedText = withPlanGate<{ id: string }>(
  "documents",
  async (_req, { userId, params }) => {
    const startedAt = Date.now();
    const doc = await prisma.document.findFirst({
      where: { id: params.id, userId },
      select: {
        id: true,
        name: true,
        url: true,
        s3Key: true,
        mimeType: true,
      },
    });
    if (!doc) return notFound();

    const text = await extractPlainTextFromStoredDocument({
      url: doc.url,
      s3Key: doc.s3Key,
      mimeType: doc.mimeType,
    });
    console.info("[perf][documents.parsed-text]", {
      userId,
      docId: doc.id,
      chars: text?.length ?? 0,
      durationMs: Date.now() - startedAt,
    });
    return ok({
      id: doc.id,
      name: doc.name,
      extracted: Boolean(text),
      chars: text?.length ?? 0,
      text: text ?? "",
    });
  },
);
