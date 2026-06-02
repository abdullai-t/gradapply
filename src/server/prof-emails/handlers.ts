import { getPostHogClient } from "@/lib/posthog-server";
import { prisma } from "@/lib/prisma";
import { touchUserActivityAsync } from "@/lib/user-activity";
import { requireWritableAccount } from "@/lib/plan-gates";

import { bad, ok } from "../_responses";
import { withAuth } from "../_with-auth";

import { createProfEmailSchema } from "./schemas";

export const list = withAuth(async (req, { userId }) => {
  const startedAt = Date.now();
  const { searchParams } = new URL(req.url);
  const takeRaw = Number.parseInt(searchParams.get("take") ?? "", 10);
  const take =
    Number.isFinite(takeRaw) && takeRaw > 0 ? Math.min(takeRaw, 100) : 50;

  const emails = await prisma.profEmail.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    take,
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

  touchUserActivityAsync(userId);
  const posthog = getPostHogClient();
  posthog?.capture({ distinctId: userId, event: "professor_email_created", properties: { university: row.university, research_area: row.researchArea } });
  return ok(row);
});
