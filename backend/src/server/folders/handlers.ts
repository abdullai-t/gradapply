// @ts-nocheck
import { prisma } from "@/lib/prisma";

import { bad, notFound, ok } from "../_responses";
import { withPlanGate } from "../_with-plan-gate";

import {
  FOLDER_LIMIT_PER_USER,
  createFolderSchema,
  patchFolderSchema,
} from "./schemas";

function hasFolderModel(): boolean {
  return Boolean((prisma as unknown as { folder?: unknown }).folder);
}

type FolderRow = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  createdAt: Date;
  updatedAt: Date;
  _count?: { documents: number };
};

function folderDelegate() {
  return (
    prisma as unknown as {
      folder?: {
        findMany: (args: unknown) => Promise<FolderRow[]>;
        count: (args: unknown) => Promise<number>;
        create: (args: unknown) => Promise<FolderRow>;
        findFirst: (args: unknown) => Promise<FolderRow | null>;
        update: (args: unknown) => Promise<FolderRow>;
        delete: (args: unknown) => Promise<unknown>;
      };
    }
  ).folder;
}

/** GET /api/folders — list the caller's folders with their document counts. */
export const list = withPlanGate("documents", async (_req, { userId }) => {
  const folder = folderDelegate();
  if (!hasFolderModel() || !folder) return ok([]);

  const folders = await folder.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { documents: true } },
    },
  });

  return ok(
    folders.map((f: FolderRow) => ({
      id: f.id,
      name: f.name,
      icon: f.icon,
      color: f.color,
      count: f._count?.documents ?? 0,
      createdAt: f.createdAt,
      updatedAt: f.updatedAt,
    })),
  );
});

/**
 * POST /api/folders — create a new folder.
 *
 * Enforces a soft cap of {@link FOLDER_LIMIT_PER_USER} folders per user and a
 * unique-name constraint (DB-level via Prisma `P2002`).
 */
export const create = withPlanGate("documents", async (req, { userId }) => {
  const folder = folderDelegate();
  if (!hasFolderModel() || !folder) {
    return bad("Folders are not enabled in this deployment.", 501);
  }

  const json = await req.json().catch(() => null);
  const parsed = createFolderSchema.safeParse(json);
  if (!parsed.success) return bad(parsed.error.flatten());

  const existingCount = await folder.count({
    where: { userId },
  });
  if (existingCount >= FOLDER_LIMIT_PER_USER) {
    return bad(
      `You've reached the ${FOLDER_LIMIT_PER_USER} folder limit. Delete an empty folder to add another.`,
    );
  }

  try {
    const created = await folder.create({
      data: {
        userId,
        name: parsed.data.name,
        icon: parsed.data.icon ?? null,
        color: parsed.data.color ?? null,
      },
    });
    return ok({ ...created, count: 0 });
  } catch (e: unknown) {
    if (
      e &&
      typeof e === "object" &&
      "code" in e &&
      (e as { code?: string }).code === "P2002"
    ) {
      return bad("A folder with that name already exists.", 409);
    }
    throw e;
  }
});

/** PATCH /api/folders/[id] — rename / restyle a folder. */
export const patch = withPlanGate<{ id: string }>(
  "documents",
  async (req, { userId, params }) => {
    const folder = folderDelegate();
    if (!hasFolderModel() || !folder) {
      return bad("Folders are not enabled in this deployment.", 501);
    }

    const json = await req.json().catch(() => null);
    const parsed = patchFolderSchema.safeParse(json);
    if (!parsed.success) return bad(parsed.error.flatten());

    const existing = await folder.findFirst({
      where: { id: params.id, userId },
    });
    if (!existing) return notFound();

    try {
      const updated = await folder.update({
        where: { id: params.id },
        data: {
          ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
          ...(parsed.data.icon !== undefined ? { icon: parsed.data.icon } : {}),
          ...(parsed.data.color !== undefined
            ? { color: parsed.data.color }
            : {}),
        },
      });
      return ok(updated);
    } catch (e: unknown) {
      if (
        e &&
        typeof e === "object" &&
        "code" in e &&
        (e as { code?: string }).code === "P2002"
      ) {
        return bad("A folder with that name already exists.", 409);
      }
      throw e;
    }
  },
);

/**
 * DELETE /api/folders/[id]
 *
 * Documents inside this folder are kept (folderId is set to null via the
 * ON DELETE SET NULL FK). User keeps their files; only the folder is removed.
 */
export const remove = withPlanGate<{ id: string }>(
  "documents",
  async (_req, { userId, params }) => {
    const folder = folderDelegate();
    if (!hasFolderModel() || !folder) {
      return bad("Folders are not enabled in this deployment.", 501);
    }

    const existing = await folder.findFirst({
      where: { id: params.id, userId },
    });
    if (!existing) return notFound();

    await folder.delete({ where: { id: params.id } });

    return ok({ ok: true });
  },
);
