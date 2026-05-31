import { prisma } from "@/lib/prisma";
import { requireWritableAccount } from "@/lib/plan-gates";

import { bad, notFound, ok } from "../_responses";
import { withAuth } from "../_with-auth";

import { updateProfEmailSchema } from "./schemas";

export const get = withAuth<{ id: string }>(async (_req, { userId, params }) => {
  const { id } = params;
  const row = await prisma.profEmail.findFirst({
    where: { id, userId },
  });
  if (!row) return notFound();
  return ok(row);
});

export const update = withAuth<{ id: string }>(
  async (req, { userId, params }) => {
    const readOnly = await requireWritableAccount(userId);
    if (readOnly) return readOnly;

    const { id } = params;
    const json = await req.json().catch(() => null);
    const parsed = updateProfEmailSchema.safeParse(json);
    if (!parsed.success) return bad({ error: parsed.error.flatten() });

    const existing = await prisma.profEmail.findFirst({
      where: { id, userId },
    });
    if (!existing) return notFound();

    const { sentAt, repliedAt, ...rest } = parsed.data;

    const row = await prisma.profEmail.update({
      where: { id },
      data: {
        ...rest,
        ...(sentAt !== undefined
          ? { sentAt: sentAt ? new Date(sentAt) : null }
          : {}),
        ...(repliedAt !== undefined
          ? { repliedAt: repliedAt ? new Date(repliedAt) : null }
          : {}),
      },
    });

    if (parsed.data.emailBody !== undefined) {
      const { schedulePushToGoogle } = await import("@/lib/google-docs/push-hook");
      schedulePushToGoogle(userId, "PROF_EMAIL", id);
    }

    return ok(row);
  },
);

export const remove = withAuth<{ id: string }>(
  async (_req, { userId, params }) => {
    const readOnly = await requireWritableAccount(userId);
    if (readOnly) return readOnly;

    const { id } = params;

    const existing = await prisma.profEmail.findFirst({
      where: { id, userId },
    });
    if (!existing) return notFound();

    await prisma.contentVersion.deleteMany({
      where: {
        userId,
        entityType: "PROF_EMAIL",
        entityId: id,
      },
    });

    await prisma.profEmail.delete({ where: { id } });

    return ok({ ok: true });
  },
);
