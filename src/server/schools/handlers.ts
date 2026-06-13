import { AdmissionTerm, SchoolStatus } from "@prisma/client";

import {
  billingPrecheckResponse,
  finalizeAiConsumptionForAction,
} from "@/lib/billing-allowance";
import { runTask } from "@/lib/agents";
import { formatLlmFailureMessage } from "@/lib/llm-errors";
import { log } from "@/lib/logger";
import {
  requireSchoolTrackingCapacity,
  requireWritableAccount,
  schoolTrackingLimitForUser,
} from "@/lib/plan-gates";
import { prisma } from "@/lib/prisma";
import { touchUserActivityAsync } from "@/lib/user-activity";
import {
  parseJsonFromLlmText,
  parseRecommendSchoolsFromLlmText,
} from "@/lib/parse-llm-json";
import { pickInferApplicationFee } from "@/lib/school-infer-application-fee";
import { buildSchoolPatchFromInfer } from "@/lib/school-infer-patch";
import { parseDeadlineBody, coerceSchoolInferDeadlineToFuture } from "@/lib/school-deadline";
import { progressFromStatus } from "@/lib/school-progress";
import {
  materialsFromInferLabels,
  normalizeLetterRecommenders,
  normalizeRequiredMaterials,
  parseInferLettersRequired,
  parseInferMaterialLabels,
  recommendersFromInferCount,
} from "@/lib/school-tracker-defaults";

import { getPostHogClient } from "@/lib/posthog-server";
import { bad, notFound, ok } from "../_responses";
import { serializeSchool, serializeSchools } from "./serialize";
import { withAuth } from "../_with-auth";

import {
  filterRecommendSchoolRows,
  shuffleWithSeed,
  type RecommendSchoolRow,
  type SchoolIdentity,
} from "@/lib/school-recommend";

import {
  bulkCreateSchoolsSchema,
  createSchoolSchema,
  inferSchoolSchema,
  recommendSchoolsSchema,
  updateSchoolSchema,
} from "./schemas";

const SCHOOL_LIST_MAX = 200;
const SCHOOL_LIST_DEFAULT = 100;

export const list = withAuth(async (req, { userId }) => {
  const url = new URL(req.url);
  const sort = url.searchParams.get("sort");
  const takeRaw = Number.parseInt(url.searchParams.get("take") ?? "", 10);
  const take =
    Number.isFinite(takeRaw) && takeRaw > 0
      ? Math.min(takeRaw, SCHOOL_LIST_MAX)
      : SCHOOL_LIST_DEFAULT;

  const schools = await prisma.school.findMany({
    where: { userId },
    orderBy:
      sort === "timeline"
        ? [{ deadline: "asc" }, { name: "asc" }]
        : [{ updatedAt: "desc" }],
    take,
  });

  return ok(serializeSchools(schools));
});

export const create = withAuth(async (req, { userId }) => {
  const readOnly = await requireWritableAccount(userId);
  if (readOnly) return readOnly;
  const cap = await requireSchoolTrackingCapacity(userId);
  if (cap) return cap;

  const json = await req.json().catch(() => null);
  const parsed = createSchoolSchema.safeParse(json);
  if (!parsed.success) return bad({ error: parsed.error.flatten() });

  const { deadline, reminderAt, requiredMaterials, letterRecommenders, ...rest } =
    parsed.data;
  const status = rest.status ?? SchoolStatus.PLANNING;

  const school = await prisma.school.create({
    data: {
      ...rest,
      status,
      progress: progressFromStatus(status),
      requiredMaterials: requiredMaterials ?? [],
      letterRecommenders: letterRecommenders ?? [],
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

  touchUserActivityAsync(userId);
  const posthog = getPostHogClient();
  posthog?.capture({ distinctId: userId, event: "school_added", properties: { school_name: school.name, program: school.program, degree: school.degree, country: school.country } });
  return ok(serializeSchool(school));
});

export const bulkCreate = withAuth(async (req, { userId }) => {
  const readOnly = await requireWritableAccount(userId);
  if (readOnly) return readOnly;

  const json = await req.json().catch(() => null);
  const parsed = bulkCreateSchoolsSchema.safeParse(json);
  if (!parsed.success) return bad({ error: parsed.error.flatten() });

  const limit = await schoolTrackingLimitForUser(userId);
  const current = await prisma.school.count({ where: { userId } });
  if (current + parsed.data.schools.length > limit) {
    return bad(
      {
        error: `You can track up to ${limit} schools on your plan. Remove some schools or upgrade to add more.`,
        code: "SCHOOL_LIMIT",
      },
      402,
    );
  }

  const created = await prisma.$transaction(
    parsed.data.schools.map((row) => {
      const { deadline, reminderAt, requiredMaterials, letterRecommenders, ...rest } =
        row;
      const status = rest.status ?? SchoolStatus.PLANNING;
      return prisma.school.create({
        data: {
          ...rest,
          status,
          progress: progressFromStatus(status),
          requiredMaterials: requiredMaterials ?? [],
          letterRecommenders: letterRecommenders ?? [],
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
    }),
  );

  touchUserActivityAsync(userId);
  return ok(serializeSchools(created));
});

export const get = withAuth<{ id: string }>(async (_req, { userId, params }) => {
  const school = await prisma.school.findFirst({
    where: { id: params.id, userId },
  });
  if (!school) return notFound("School not found");
  return ok(serializeSchool(school));
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

    const { deadline, reminderAt, requiredMaterials, letterRecommenders, ...rest } =
      parsed.data;

    const school = await prisma.school.update({
      where: { id },
      data: {
        ...rest,
        ...(requiredMaterials !== undefined ? { requiredMaterials } : {}),
        ...(letterRecommenders !== undefined ? { letterRecommenders } : {}),
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

    touchUserActivityAsync(userId);
    return ok(serializeSchool(school));
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

const RECOMMEND_TIERS = [
  { bucket: "top_tier", label: "top-tier reach" },
  { bucket: "mid_tier", label: "mid-tier match" },
  { bucket: "safety", label: "safety" },
] as const;

function buildProfileContextBlock(profile: {
  targetDegree: string | null;
  focusArea: string | null;
  researchInterests: string | null;
  bio: string | null;
  countriesOfInterest: string[];
} | null): string {
  if (!profile) return "";
  const lines: string[] = ["Applicant profile for fit:"];
  if (profile.targetDegree?.trim()) {
    lines.push(`- Target degree: ${profile.targetDegree.trim()}`);
  }
  if (profile.focusArea?.trim()) {
    lines.push(`- Program focus: ${profile.focusArea.trim()}`);
  }
  if (profile.researchInterests?.trim()) {
    lines.push(`- Research interests: ${profile.researchInterests.trim()}`);
  }
  if (profile.bio?.trim()) {
    lines.push(`- Bio: ${profile.bio.trim().slice(0, 400)}`);
  }
  if (profile.countriesOfInterest.length > 0) {
    lines.push(
      `- Countries of interest: ${profile.countriesOfInterest.join(", ")}`,
    );
  }
  return lines.length > 1 ? lines.join("\n") : "";
}

function buildOnboardingRecommendPrompt(opts: {
  countryHint: string;
  profileContext: string;
  excludeBlock: string;
  variationBlock: string;
  retry: boolean;
}): string {
  const { countryHint, profileContext, excludeBlock, variationBlock, retry } =
    opts;
  const lines = [
    "Recommend exactly 5 graduate schools for an onboarding shortlist.",
    "Balance tiers: roughly 2 top_tier (reach), 2 mid_tier (match), 1 safety.",
    'Set tierBucket on each row to "top_tier", "mid_tier", or "safety".',
    "Selection criteria (in order): (1) research fit to my profile and interests, (2) realistic funding availability (RA/TA, stipend, tuition waiver, or competitive scholarships).",
    "Deprioritize programs that are typically unfunded unless the research fit is exceptional.",
    "whyFit: one sentence on research fit only (<= 22 words).",
    "funding: one sentence on typical funding availability for this program (<= 22 words).",
    "notes: optional deadline or GRE caveat (<= 12 words) or null.",
    excludeBlock,
    variationBlock,
    countryHint,
    profileContext,
    'Return ONLY minified JSON: {"schools":[{"name","program","degree","country","tierBucket","whyFit","funding","notes","portalUrl":null}]}',
    "Never include a school on the exclusion list (same institution or same program).",
    "No markdown fences or prose before or after the JSON.",
  ];
  if (retry) {
    lines.push(
      "Previous output was invalid JSON. Output a single minified JSON object only.",
    );
  }
  return lines.join("\n");
}

function buildTierRecommendPrompt(opts: {
  tier: (typeof RECOMMEND_TIERS)[number];
  countryHint: string;
  profileContext: string;
  excludeBlock: string;
  variationBlock: string;
  retry: boolean;
}): string {
  const { tier, countryHint, profileContext, excludeBlock, variationBlock, retry } =
    opts;
  const lines = [
    `Recommend exactly 5 ${tier.label} graduate schools for my tracking list.`,
    `Set tierBucket to "${tier.bucket}" on every row.`,
    "Selection criteria (in order): (1) research fit to my profile and interests, (2) realistic funding availability (RA/TA, stipend, tuition waiver, or competitive scholarships).",
    "Deprioritize programs that are typically unfunded unless the research fit is exceptional.",
    "whyFit: one sentence on research fit only (<= 22 words).",
    "funding: one sentence on typical funding availability for this program (<= 22 words).",
    "notes: optional deadline or GRE caveat (<= 12 words) or null.",
    excludeBlock,
    variationBlock,
    countryHint,
    profileContext,
    'Return ONLY minified JSON: {"schools":[{"name","program","degree","country","tierBucket","whyFit","funding","notes","portalUrl":null}]}',
    "Never include a school on the exclusion list (same institution or same program).",
    "No markdown fences or prose before or after the JSON.",
  ];
  if (retry) {
    lines.push("Previous output was invalid JSON. Output a single minified JSON object only.");
  }
  return lines.join("\n");
}

function buildExcludeBlock(excludeFrom: SchoolIdentity[]): string {
  if (excludeFrom.length === 0) {
    return "Exclusion list: none (only avoid duplicates within this response).";
  }
  const lines = excludeFrom.slice(0, 60).map((s) => {
    const program = s.program?.trim();
    return program ? `- ${s.name.trim()} (${program})` : `- ${s.name.trim()}`;
  });
  return [
    `Exclusion list — do NOT recommend these ${excludeFrom.length} school/program entries (already on my list or shown in a prior search):`,
    ...lines,
  ].join("\n");
}

function buildVariationBlock(searchSeed: string): string {
  return [
    `Search run id: ${searchSeed}.`,
    "Pick different institutions than any prior search for this user; explore diverse departments and regions that still match profile and funding goals.",
  ].join("\n");
}

function normalizeRecommendRow(row: RecommendSchoolRow): Record<string, unknown> {
  return {
    name: typeof row.name === "string" ? row.name.trim() : "",
    program: typeof row.program === "string" ? row.program.trim() : "",
    degree: typeof row.degree === "string" ? row.degree.trim() : "",
    country: typeof row.country === "string" ? row.country.trim() : "",
    tierBucket: typeof row.tierBucket === "string" ? row.tierBucket.trim() : "",
    whyFit: typeof row.whyFit === "string" ? row.whyFit.trim() : "",
    funding: typeof row.funding === "string" ? row.funding.trim() : "",
    notes:
      typeof row.notes === "string"
        ? row.notes.trim()
        : row.notes === null
          ? ""
          : "",
    portalUrl:
      typeof row.portalUrl === "string" ? row.portalUrl.trim() : null,
  };
}

async function fetchOnboardingSchools(
  userId: string,
  countryHint: string,
  profileContext: string,
  excludeFrom: SchoolIdentity[],
  searchSeed: string,
): Promise<unknown[]> {
  const excludeBlock = buildExcludeBlock(excludeFrom);
  const variationBlock = buildVariationBlock(searchSeed);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const prompt = buildOnboardingRecommendPrompt({
      countryHint,
      profileContext,
      excludeBlock,
      variationBlock,
      retry: attempt > 0,
    });
    try {
      const result = await runTask("school-intel", prompt, userId, {
        recommendSearchSeed: searchSeed,
      });
      const raw = result.reply.trim();
      try {
        const schools = parseRecommendSchoolsFromLlmText(raw);
        log.debug("schools/recommend.onboarding", {
          userId,
          attempt: attempt + 1,
          schoolCount: schools.length,
        });
        return schools.slice(0, 5);
      } catch (e) {
        log.warn("schools/recommend.onboarding.invalid-json", {
          userId,
          attempt: attempt + 1,
          preview: raw.slice(0, 400),
          reason: e instanceof Error ? e.message : "unknown",
        });
      }
    } catch (e) {
      log.warn("schools/recommend.onboarding-error", {
        userId,
        attempt: attempt + 1,
        reason: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return [];
}

async function fetchTierSchools(
  userId: string,
  tier: (typeof RECOMMEND_TIERS)[number],
  countryHint: string,
  profileContext: string,
  excludeFrom: SchoolIdentity[],
  searchSeed: string,
): Promise<unknown[]> {
  const excludeBlock = buildExcludeBlock(excludeFrom);
  const variationBlock = buildVariationBlock(searchSeed);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const prompt = buildTierRecommendPrompt({
      tier,
      countryHint,
      profileContext,
      excludeBlock,
      variationBlock,
      retry: attempt > 0,
    });
    try {
      const result = await runTask("school-intel", prompt, userId, {
        recommendSearchSeed: searchSeed,
      });
      const raw = result.reply.trim();
      try {
        const schools = parseRecommendSchoolsFromLlmText(raw);
        log.debug("schools/recommend.tier", {
          userId,
          tier: tier.bucket,
          attempt: attempt + 1,
          schoolCount: schools.length,
          provider: result.modelUsed?.provider,
          model: result.modelUsed?.model,
          replyChars: raw.length,
        });
        return schools;
      } catch (e) {
        log.warn("schools/recommend.invalid-json", {
          userId,
          tier: tier.bucket,
          attempt: attempt + 1,
          preview: raw.slice(0, 400),
          reason: e instanceof Error ? e.message : "unknown",
        });
      }
    } catch (e) {
      log.warn("schools/recommend.tier-error", {
        userId,
        tier: tier.bucket,
        attempt: attempt + 1,
        reason: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return [];
}

export const recommend = withAuth(async (req, { userId }) => {
  const json = await req.json().catch(() => ({}));
  const parsedBody = recommendSchoolsSchema.safeParse(json);
  const isOnboardingRequest =
    parsedBody.success && parsedBody.data.onboarding === true;
  const sessionExclude: SchoolIdentity[] =
    parsedBody.success && !isOnboardingRequest
      ? (parsedBody.data.sessionExclude ?? []).map((s) => ({
          name: s.name,
          program: s.program ?? null,
        }))
      : [];

  const profileForBilling = await prisma.profile.findUnique({
    where: { userId },
    select: { onboardingRecommendSeenAt: true },
  });
  const freeOnboardingRecommend =
    isOnboardingRequest && !profileForBilling?.onboardingRecommendSeenAt;

  if (!freeOnboardingRecommend) {
    const quota = await billingPrecheckResponse(userId, "school_recommendation");
    if (quota) return quota;
  }

  try {
    log.debug("schools/recommend.start", { userId, isOnboardingRequest });
    const [profile, trackedSchools] = await Promise.all([
      prisma.profile.findUnique({
        where: { userId },
        select: {
          countriesOfInterest: true,
          targetDegree: true,
          focusArea: true,
          researchInterests: true,
          bio: true,
          onboardingRecommendSeenAt: true,
        },
      }),
      prisma.school.findMany({
        where: { userId },
        select: { name: true, program: true },
      }),
    ]);

    const profileContext = buildProfileContextBlock(
      profile
        ? {
            targetDegree: profile.targetDegree,
            focusArea: profile.focusArea,
            researchInterests: profile.researchInterests,
            bio: profile.bio,
            countriesOfInterest: Array.isArray(profile.countriesOfInterest)
              ? profile.countriesOfInterest.filter(
                  (c) => typeof c === "string" && c.trim(),
                )
              : [],
          }
        : null,
    );

    const excludeFrom: SchoolIdentity[] = isOnboardingRequest
      ? trackedSchools.map((s) => ({ name: s.name, program: s.program }))
      : [
          ...trackedSchools.map((s) => ({ name: s.name, program: s.program })),
          ...sessionExclude,
        ];

    const searchSeed = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    const tierOrder = shuffleWithSeed(RECOMMEND_TIERS, searchSeed.length + userId.length);

    const countriesOfInterest = Array.isArray(profile?.countriesOfInterest)
      ? profile.countriesOfInterest.filter((c) => typeof c === "string" && c.trim())
      : [];
    const countryHint =
      countriesOfInterest.length > 0
        ? `Only recommend schools in these countries of interest: ${countriesOfInterest.join(", ")}.`
        : "If no countries of interest are set, you may recommend across countries.";

    const rawSchools: unknown[] = isOnboardingRequest
      ? await fetchOnboardingSchools(
          userId,
          countryHint,
          profileContext,
          excludeFrom,
          searchSeed,
        )
      : (
          await Promise.all(
            tierOrder.map((tier) =>
              fetchTierSchools(
                userId,
                tier,
                countryHint,
                profileContext,
                excludeFrom,
                searchSeed,
              ),
            ),
          )
        ).flat();

    let schools = filterRecommendSchoolRows(rawSchools, excludeFrom).map(
      normalizeRecommendRow,
    );

    if (isOnboardingRequest) {
      schools = schools.slice(0, 5);
    }

    if (schools.length === 0) {
      throw new SyntaxError("Could not parse JSON from model output");
    }

    log.info("schools/recommend.ok", {
      userId,
      schoolCount: schools.length,
      excludedTracked: trackedSchools.length,
      excludedSession: sessionExclude.length,
      searchSeed,
    });

    if (freeOnboardingRecommend) {
      await prisma.profile.upsert({
        where: { userId },
        create: { userId, onboardingRecommendSeenAt: new Date() },
        update: { onboardingRecommendSeenAt: new Date() },
      });
    } else {
      await finalizeAiConsumptionForAction(userId, "school_recommendation");
    }

    if (countriesOfInterest.length > 0) {
      const countrySet = new Set(countriesOfInterest.map((c) => c.toLowerCase()));
      const countryMatched = schools.filter((row) => {
        const country =
          typeof row.country === "string" ? row.country.trim().toLowerCase() : "";
        return country.length > 0 && countrySet.has(country);
      });
      if (countryMatched.length > 0) schools = countryMatched;
    }

    return ok({ schools, searchSeed });
  } catch (e) {
    log.error("schools/recommend.failed", {
      userId,
      reason: e instanceof Error ? e.message : String(e),
    });
    return bad(formatLlmFailureMessage(e), 500);
  }
});

function coerceInferTerm(v: unknown): AdmissionTerm | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== "string") return null;
  const u = v.trim().toUpperCase();
  if (u === "FALL" || u === "SPRING" || u === "SUMMER") return u as AdmissionTerm;
  return null;
}

function normalizeInferDeadline(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s) return null;
  const d = parseDeadlineBody(s);
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

function normalizeInferPortalUrl(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) return null;
  if (s.length > 2000) return null;
  return s;
}

export const infer = withAuth(async (req, { userId }) => {
  const json = await req.json().catch(() => null);
  const parsed = inferSchoolSchema.safeParse(json);
  if (!parsed.success) return bad({ error: parsed.error.flatten() });

  const quota = await billingPrecheckResponse(userId, "school_infer");
  if (quota) return quota;

  try {
    let contextName: string;
    let program = "";
    let degree = "";
    let country: string | null = null;
    let department = "";
    let college = "";
    let termHint: AdmissionTerm | null | undefined = parsed.data.term;
    let existingRow: Awaited<
      ReturnType<typeof prisma.school.findFirst>
    > = null;

    if (parsed.data.schoolId) {
      const row = await prisma.school.findFirst({
        where: { id: parsed.data.schoolId, userId },
      });
      if (!row) return notFound();
      existingRow = row;
      contextName = row.name;
      program = row.program;
      degree = row.degree;
      country = row.country;
      department = row.department ?? "";
      college = row.college ?? "";
      if (termHint === undefined) termHint = row.term ?? undefined;
    } else {
      contextName = parsed.data.name!.trim();
    }

    const todayUtc = new Date().toISOString().slice(0, 10);

    const message = [
      "Research official graduate application requirements for this program and return structured tracking fields.",
      `School / institution: "${contextName}"`,
      program ? `Program (from user record): ${program}` : "",
      degree ? `Degree (from user record): ${degree}` : "",
      country ? `Country (from user record): ${country}` : "",
      department ? `Department (from user record): ${department}` : "",
      college ? `College / school (from user record): ${college}` : "",
      termHint ? `Preferred intake term hint: ${termHint}` : "",
      "",
      "Use the applicant's program + department to look up the correct department-level requirements (not a generic university page).",
      "List each distinct required application component the program officially asks for (documents, tests, forms).",
      "Look up the published graduate application fee on the official admissions or graduate college site (fee schedule, how to apply, or FAQ) and return it in applicationFee.",
      "",
      `Today's calendar date (UTC) is ${todayUtc}.`,
      `The application deadline MUST be ${todayUtc} or a later date for an upcoming admissions cycle — never a year that is already in the past relative to today.`,
      "If you cannot verify a current-cycle deadline from reliable public information, use null for deadline.",
      "",
      "Return ONLY valid JSON with these keys (use null when unknown or not confident):",
      '- program (string), degree (string), country (string)',
      '- term: one of \"FALL\" | \"SPRING\" | \"SUMMER\" or null (primary admission intake term)',
      `- deadline: primary application deadline as \"YYYY-MM-DD\" on or after ${todayUtc} (UTC), or null`,
      '- funding: short string (funding / stipend / tuition typical for this program), or null',
      '- applicationFee: REQUIRED to attempt — official graduate application fee as published (e.g. "$85", "USD 75", "$0", "waived for domestic applicants"); null only if no fee is published online',
      '- notes: brief note on tests/portfolio (GRE, TOEFL, etc.) under 280 chars — do not repeat the application fee here, or null',
      '- applicationRequirementsSummary: 2–4 sentences summarizing official requirements (deadlines window, test policy, interview, portfolio), or null',
      '- portalUrl: official https application or graduate admissions portal URL, or null',
      '- programUrl: official https program or department page URL, or null',
      '- department: academic department name, or null',
      '- college: college or school within the university (e.g. College of Engineering), or null',
      '- primaryProfessor: suggested faculty contact name only if clearly public on the program site, or null',
      '- backupProfessors: free-text backup faculty contacts if listed publicly, or null',
      "- requiredMaterialLabels: JSON array of strings — each official required item (e.g. Resume/CV, Statement of purpose, Writing sample, Transcripts, GRE scores, Letters of recommendation). Use official program wording when known. Empty array if unknown.",
      '- lettersRequired: integer count of recommendation letters required (e.g. 3), or null if unknown',
      "",
      "Ground answers in well-known public information; prefer official university domains for portalUrl and programUrl.",
      "Never invent a precise deadline, URL, fee amount, or material you cannot verify — use null or an empty array.",
    ]
      .filter(Boolean)
      .join("\n");

    const result = await runTask("school-intel", message, userId, {
      schoolName: contextName,
      term: termHint ?? null,
      inferOnly: true,
      ...(parsed.data.schoolId ? { schoolId: parsed.data.schoolId } : {}),
    });

    const raw = result.reply.trim();
    let fields: Record<string, unknown>;
    try {
      fields = parseJsonFromLlmText(raw) as Record<string, unknown>;
    } catch (e) {
      console.warn("[schools/infer] invalid JSON from model", {
        userId,
        preview: raw.slice(0, 400),
        reason: e instanceof Error ? e.message : "unknown",
      });
      throw e;
    }

    const term = coerceInferTerm(fields.term);
    const deadlineNorm = normalizeInferDeadline(fields.deadline);
    const deadline = coerceSchoolInferDeadlineToFuture(deadlineNorm);
    if (deadlineNorm && deadline && deadline !== deadlineNorm) {
      log.info("schools/infer.deadline-advanced-to-future", {
        userId,
        from: deadlineNorm,
        to: deadline,
      });
    }
    if (deadlineNorm && !deadline) {
      log.warn("schools/infer.deadline-dropped-invalid-or-stale", {
        userId,
        raw: deadlineNorm,
      });
    }
    const portalUrl = normalizeInferPortalUrl(fields.portalUrl);
    const programUrl = normalizeInferPortalUrl(fields.programUrl);

    const materialLabels = parseInferMaterialLabels(fields.requiredMaterialLabels);
    const lettersRequired = parseInferLettersRequired(fields.lettersRequired);

    const existingMaterials = existingRow
      ? normalizeRequiredMaterials(existingRow.requiredMaterials)
      : [];
    const existingLetters = existingRow
      ? normalizeLetterRecommenders(existingRow.letterRecommenders)
      : [];

    const out: Record<string, unknown> = {
      program: typeof fields.program === "string" ? fields.program.trim() || null : null,
      degree: typeof fields.degree === "string" ? fields.degree.trim() || null : null,
      country: typeof fields.country === "string" ? fields.country.trim() || null : null,
      term,
      deadline,
      funding: typeof fields.funding === "string" ? fields.funding.trim() || null : null,
      applicationFee: pickInferApplicationFee(fields),
      notes: typeof fields.notes === "string" ? fields.notes.trim() || null : null,
      applicationRequirementsSummary:
        typeof fields.applicationRequirementsSummary === "string"
          ? fields.applicationRequirementsSummary.trim() || null
          : null,
      portalUrl,
      programUrl,
      department:
        typeof fields.department === "string"
          ? fields.department.trim() || null
          : null,
      college:
        typeof fields.college === "string" ? fields.college.trim() || null : null,
      primaryProfessor:
        typeof fields.primaryProfessor === "string"
          ? fields.primaryProfessor.trim() || null
          : null,
      backupProfessors:
        typeof fields.backupProfessors === "string"
          ? fields.backupProfessors.trim() || null
          : null,
      requiredMaterialLabels: materialLabels,
      lettersRequired,
      ...(materialLabels.length > 0
        ? {
            requiredMaterials: materialsFromInferLabels(
              materialLabels,
              existingMaterials,
            ),
          }
        : {}),
      ...(lettersRequired != null && lettersRequired > 0
        ? {
            letterRecommenders: recommendersFromInferCount(
              lettersRequired,
              existingLetters,
            ),
          }
        : {}),
    };

    await finalizeAiConsumptionForAction(userId, "school_infer");

    if (parsed.data.schoolId && existingRow) {
      const patch = buildSchoolPatchFromInfer(
        out,
        serializeSchool(existingRow),
      );
      const patchParsed = updateSchoolSchema.safeParse(patch);
      if (patchParsed.success && Object.keys(patchParsed.data).length > 0) {
        const readOnly = await requireWritableAccount(userId);
        if (readOnly) return readOnly;

        const { deadline, reminderAt, ...rest } = patchParsed.data;
        const updated = await prisma.school.update({
          where: { id: existingRow.id },
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
        touchUserActivityAsync(userId);
        return ok({ ...out, school: serializeSchool(updated) });
      }
    }

    return ok(out);
  } catch (e) {
    return bad(formatLlmFailureMessage(e), 500);
  }
});
