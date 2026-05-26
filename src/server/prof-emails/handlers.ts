import { prisma } from "@/lib/prisma";
import { requireWritableAccount } from "@/lib/plan-gates";

import { bad, ok } from "../_responses";
import { withAuth } from "../_with-auth";

import { createProfEmailSchema } from "./schemas";

export const list = withAuth(async (_req, { userId }) => {
  const startedAt = Date.now();
  const emails = await prisma.profEmail.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      profName: true,
      profEmail: true,
      university: true,
      researchArea: true,
      matchScore: true,
      status: true,
      updatedAt: true,
    },
  });
  console.info("[perf][prof-emails.list.light]", {
    userId,
    rows: emails.length,
    durationMs: Date.now() - startedAt,
  });

  return ok(emails);
});

export const create = withAuth(async (req, { userId }) => {
  const readOnly = await requireWritableAccount(userId);
  if (readOnly) return readOnly;

  const json = await req.json().catch(() => null);
  const parsed = createProfEmailSchema.safeParse(json);
  if (!parsed.success) return bad({ error: parsed.error.flatten() });

  const row = await prisma.profEmail.create({
    data: {
      ...parsed.data,
      userId,
    },
  });

  return ok(row);
});
