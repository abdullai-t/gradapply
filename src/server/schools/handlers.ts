import { SchoolStatus } from "@prisma/client";

import {
  billingPrecheckResponse,
  finalizeAiConsumption,
} from "@/lib/billing-allowance";
import { formatLlmFailureMessage } from "@/lib/llm-errors";
import { prisma } from "@/lib/prisma";
import { parseDeadlineBody } from "@/lib/school-deadline";
import { inferSchoolDetailsFromName } from "@/lib/school-from-name-ai";
import { progressFromStatus } from "@/lib/school-progress";
import { recommendSchoolsFromProfile } from "@/lib/school-recommendations-ai";

import { bad, notFound, ok } from "../_responses";
import { withAuth } from "../_with-auth";

import {
  createSchoolSchema,
  inferSchoolSchema,
  updateSchoolSchema,
} from "./schemas";

export const list = withAuth(async (req, { userId }) => {
  const sort = new URL(req.url).searchParams.get("sort");
  const schools = await prisma.school.findMany({
    where: { userId },
    orderBy:
      sort === "timeline"
        ? [{ deadline: "asc" }, { name: "asc" }]
        : [{ updatedAt: "desc" }],
  });

  return ok(schools);
});

export const create = withAuth(async (req, { userId }) => {
  const json = await req.json().catch(() => null);
  const parsed = createSchoolSchema.safeParse(json);
  if (!parsed.success) return bad({ error: parsed.error.flatten() });

  const { deadline, reminderAt, ...rest } = parsed.data;
  const status = rest.status ?? SchoolStatus.PLANNING;

  const school = await prisma.school.create({
    data: {
      ...rest,
      status,
      progress: progressFromStatus(status),
      userId,
      deadline:
        deadline === undefined
          ? undefined
          : deadline === null || deadline === ""
            ? null
            : parseDeadlineBody(deadline),
      reminderAt:
        reminderAt === undefined
          ? undefined
          : reminderAt === null || reminderAt === ""
            ? null
            : parseDeadlineBody(reminderAt),
    },
  });

  return ok(school);
});

export const update = withAuth<{ id: string }>(
  async (req, { userId, params }) => {
    const { id } = params;
    const json = await req.json().catch(() => null);
    const parsed = updateSchoolSchema.safeParse(json);
    if (!parsed.success) return bad({ error: parsed.error.flatten() });

    const existing = await prisma.school.findFirst({
      where: { id, userId },
    });
    if (!existing) return notFound();

    const { deadline, reminderAt, ...rest } = parsed.data;

    const school = await prisma.school.update({
      where: { id },
      data: {
        ...rest,
        ...(rest.status !== undefined
          ? { progress: progressFromStatus(rest.status) }
          : {}),
        ...(deadline !== undefined
          ? {
              deadline:
                deadline === null || deadline === ""
                  ? null
                  : parseDeadlineBody(deadline),
            }
          : {}),
        ...(reminderAt !== undefined
          ? {
              reminderAt:
                reminderAt === null || reminderAt === ""
                  ? null
                  : parseDeadlineBody(reminderAt),
            }
          : {}),
      },
    });

    return ok(school);
  },
);

export const remove = withAuth<{ id: string }>(
  async (_req, { userId, params }) => {
    const { id } = params;

    const existing = await prisma.school.findFirst({
      where: { id, userId },
    });
    if (!existing) return notFound();

    await prisma.school.delete({ where: { id } });

    return ok({ ok: true });
  },
);

export const recommend = withAuth(async (_req, { userId }) => {
  const quota = await billingPrecheckResponse(userId);
  if (quota) return quota;

  const [profile, schools] = await Promise.all([
    prisma.profile.findUnique({ where: { userId } }),
    prisma.school.findMany({
      where: { userId },
      select: { name: true },
      distinct: ["name"],
    }),
  ]);

  try {
    const recommendations = await recommendSchoolsFromProfile({
      profile,
      existingSchoolNames: schools.map((s) => s.name),
      userId,
    });

    await finalizeAiConsumption(userId);

    return ok({ schools: recommendations });
  } catch (e) {
    return bad(formatLlmFailureMessage(e), 500);
  }
});

export const infer = withAuth(async (req, { userId }) => {
  const json = await req.json().catch(() => null);
  const parsed = inferSchoolSchema.safeParse(json);
  if (!parsed.success) return bad({ error: parsed.error.flatten() });

  const quota = await billingPrecheckResponse(userId);
  if (quota) return quota;

  const profile = await prisma.profile.findUnique({
    where: { userId },
  });

  try {
    const fields = await inferSchoolDetailsFromName({
      schoolName: parsed.data.name.trim(),
      term: parsed.data.term ?? null,
      profile,
      userId,
    });
    await finalizeAiConsumption(userId);
    return ok(fields);
  } catch (e) {
    return bad(formatLlmFailureMessage(e), 500);
  }
});
