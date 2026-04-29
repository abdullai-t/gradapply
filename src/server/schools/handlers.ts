import { SchoolStatus } from "@prisma/client";

import {
  billingPrecheckResponse,
  finalizeAiConsumptionForAction,
} from "@/lib/billing-allowance";
import { runTask } from "@/lib/agents";
import { formatLlmFailureMessage } from "@/lib/llm-errors";
import {
  requireSchoolTrackingCapacity,
  requireWritableAccount,
} from "@/lib/plan-gates";
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
  const readOnly = await requireWritableAccount(userId);
  if (readOnly) return readOnly;
  const cap = await requireSchoolTrackingCapacity(userId);
  if (cap) return cap;

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
    const readOnly = await requireWritableAccount(userId);
    if (readOnly) return readOnly;

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
    const readOnly = await requireWritableAccount(userId);
    if (readOnly) return readOnly;

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
  const quota = await billingPrecheckResponse(userId, "school_recommendation");
  if (quota) return quota;

  try {
    const profile = await prisma.profile.findUnique({
      where: { userId },
      select: { countriesOfInterest: true },
    });
    const countriesOfInterest = Array.isArray(profile?.countriesOfInterest)
      ? profile.countriesOfInterest.filter((c) => typeof c === "string" && c.trim())
      : [];
    const countryHint =
      countriesOfInterest.length > 0
        ? `Only recommend schools in these countries of interest: ${countriesOfInterest.join(", ")}.`
        : "If no countries of interest are set, you may recommend across countries.";

    const result = await runTask(
      "school-intel",
      [
        "Recommend 8 graduate schools for my tracking list based on my profile.",
        countryHint,
        "Return ONLY valid JSON with shape: { \"schools\": [{ \"name\", \"program\", \"degree\", \"country\", \"whyFit\", \"notes\", \"portalUrl\" }] }",
      ].join("\n"),
      userId,
    );

    await finalizeAiConsumptionForAction(userId, "school_recommendation");

    const raw = result.reply.trim();
    const fenced = raw.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
    const candidate = fenced ? fenced[1] : raw;
    const parsed = JSON.parse(candidate) as { schools?: unknown[] };
    const schools = Array.isArray(parsed?.schools) ? parsed.schools : [];

    if (countriesOfInterest.length === 0) {
      return ok({ schools });
    }

    const countrySet = new Set(countriesOfInterest.map((c) => c.toLowerCase()));
    const countryMatched = schools.filter((row) => {
      const country =
        typeof (row as { country?: unknown }).country === "string"
          ? (row as { country: string }).country.trim().toLowerCase()
          : "";
      return country.length > 0 && countrySet.has(country);
    });

    return ok({ schools: countryMatched.length > 0 ? countryMatched : schools });
  } catch (e) {
    return bad(formatLlmFailureMessage(e), 500);
  }
});

export const infer = withAuth(async (req, { userId }) => {
  const json = await req.json().catch(() => null);
  const parsed = inferSchoolSchema.safeParse(json);
  if (!parsed.success) return bad({ error: parsed.error.flatten() });

  const quota = await billingPrecheckResponse(userId, "school_infer");
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

    await finalizeAiConsumptionForAction(userId, "school_infer");

    const raw = result.reply.trim();
    const fenced = raw.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
    const candidate = fenced ? fenced[1] : raw;
    const fields = JSON.parse(candidate);
    return ok(fields);
  } catch (e) {
    return bad(formatLlmFailureMessage(e), 500);
  }
});
