import { SchoolStatus } from "@prisma/client";

import {
  billingPrecheckResponse,
  finalizeAiConsumption,
} from "@/lib/billing-allowance";
import { runTask } from "@/lib/agents";
import { formatLlmFailureMessage } from "@/lib/llm-errors";
import { prisma } from "@/lib/prisma";
import { parseDeadlineBody } from "@/lib/school-deadline";
import { progressFromStatus } from "@/lib/school-progress";

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

  try {
    const result = await runTask(
      "school-intel",
      "Recommend 8 graduate schools for my tracking list based on my profile. Return ONLY valid JSON with shape: { \"schools\": [{ \"name\", \"program\", \"degree\", \"country\", \"whyFit\", \"notes\", \"portalUrl\" }] }",
      userId,
    );

    await finalizeAiConsumption(userId);

    const raw = result.reply.trim();
    const fenced = raw.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
    const candidate = fenced ? fenced[1] : raw;
    const parsed = JSON.parse(candidate) as { schools?: unknown[] };
    return ok({ schools: Array.isArray(parsed?.schools) ? parsed.schools : [] });
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

  try {
    const message = [
      `Infer application-tracking fields for this school: "${parsed.data.name.trim()}"`,
      parsed.data.term ? `Intake term: ${parsed.data.term}` : "",
      "Return ONLY valid JSON with keys: program, degree, country, deadline, funding, notes, portalUrl.",
    ].filter(Boolean).join("\n");

    const result = await runTask("school-intel", message, userId, {
      schoolName: parsed.data.name.trim(),
      term: parsed.data.term ?? null,
    });

    await finalizeAiConsumption(userId);

    const raw = result.reply.trim();
    const fenced = raw.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
    const candidate = fenced ? fenced[1] : raw;
    const fields = JSON.parse(candidate);
    return ok(fields);
  } catch (e) {
    return bad(formatLlmFailureMessage(e), 500);
  }
});
