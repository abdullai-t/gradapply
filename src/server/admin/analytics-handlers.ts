import { PlanTier } from "@prisma/client";
import { NextResponse } from "next/server";

import {
  getCloudflareWorkerMetrics,
  getObservabilityLinks,
} from "@/lib/observability/cloudflare-analytics";
import type { PrismaClient } from "@prisma/client";

import { getAnalyticsDb, hasPrismaModel } from "@/lib/prisma";
import { utcDayStart } from "@/lib/user-activity";

import { bad } from "../_responses";
import { withAdmin } from "../_with-admin";

export type AnalyticsRange = "7d" | "30d" | "90d";

const NO_STORE_HEADERS = { headers: { "Cache-Control": "no-store" } };
const CACHE_MS = 60_000;

type CacheEntry = {
  key: string;
  at: number;
  payload: unknown;
};

let analyticsCache: CacheEntry | null = null;

function parseRange(raw: string | null): AnalyticsRange | null {
  if (raw === "7d" || raw === "30d" || raw === "90d") return raw;
  return null;
}

function rangeToDays(range: AnalyticsRange): number {
  if (range === "7d") return 7;
  if (range === "30d") return 30;
  return 90;
}

function sinceDate(range: AnalyticsRange): Date {
  return new Date(Date.now() - rangeToDays(range) * 24 * 60 * 60 * 1000);
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function buildDayBuckets(since: Date, days: number): string[] {
  const buckets: string[] = [];
  const start = utcDayStart(since);
  for (let i = 0; i < days; i++) {
    const d = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
    buckets.push(isoDay(d));
  }
  return buckets;
}

function countByUtcDay(
  dates: Date[],
  bucketKeys: string[],
): Array<{ date: string; count: number }> {
  const map = new Map(bucketKeys.map((k) => [k, 0]));
  for (const d of dates) {
    const key = isoDay(utcDayStart(d));
    if (map.has(key)) map.set(key, (map.get(key) ?? 0) + 1);
  }
  return bucketKeys.map((date) => ({ date, count: map.get(date) ?? 0 }));
}

function isMissingTableError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = "code" in err ? String((err as { code?: string }).code) : "";
  return code === "P2021" || code === "P2010";
}

async function countActiveUsersFromEntities(
  db: PrismaClient,
  since: Date,
  until?: Date,
): Promise<number> {
  const createdAt =
    until != null ? { gte: since, lt: until } : { gte: since };
  const where = { createdAt };

  const [llm, chat, school, profEmail, sop, collab] = await Promise.all([
    db.llmCostLog.findMany({
      where,
      select: { userId: true },
      distinct: ["userId"],
    }),
    db.chatMessage.findMany({
      where,
      select: { userId: true },
      distinct: ["userId"],
    }),
    db.school.findMany({
      where,
      select: { userId: true },
      distinct: ["userId"],
    }),
    db.profEmail.findMany({
      where,
      select: { userId: true },
      distinct: ["userId"],
    }),
    db.sopVariant.findMany({
      where,
      select: { userId: true },
      distinct: ["userId"],
    }),
    hasPrismaModel(db, "collaborationSession", "findMany")
      ? db.collaborationSession.findMany({
          where,
          select: { ownerId: true },
          distinct: ["ownerId"],
        })
      : Promise.resolve([] as Array<{ ownerId: string }>),
  ]);

  const ids = new Set<string>();
  for (const row of llm) ids.add(row.userId);
  for (const row of chat) ids.add(row.userId);
  for (const row of school) ids.add(row.userId);
  for (const row of profEmail) ids.add(row.userId);
  for (const row of sop) ids.add(row.userId);
  for (const row of collab) ids.add(row.ownerId);
  return ids.size;
}

async function countDistinctActiveUsers(
  db: PrismaClient,
  since: Date,
): Promise<number> {
  if (!hasPrismaModel(db, "userActivityDay", "findMany")) {
    return countActiveUsersFromEntities(db, since);
  }
  try {
    const rows = await db.userActivityDay.findMany({
      where: { activeOn: { gte: since } },
      select: { userId: true },
      distinct: ["userId"],
    });
    return rows.length;
  } catch (err) {
    if (!isMissingTableError(err)) throw err;
    return countActiveUsersFromEntities(db, since);
  }
}

async function countDau(db: PrismaClient): Promise<number> {
  const yesterday = utcDayStart(
    new Date(Date.now() - 24 * 60 * 60 * 1000),
  );
  const today = utcDayStart();

  if (!hasPrismaModel(db, "userActivityDay", "count")) {
    return countActiveUsersFromEntities(db, yesterday, today);
  }
  try {
    return await db.userActivityDay.count({
      where: { activeOn: yesterday },
    });
  } catch (err) {
    if (!isMissingTableError(err)) throw err;
    return countActiveUsersFromEntities(db, yesterday, today);
  }
}

async function countGoogleDocLinks(
  db: PrismaClient,
  dateFilter: { createdAt: { gte: Date } },
): Promise<number> {
  if (!hasPrismaModel(db, "googleDocLink", "count")) {
    return 0;
  }
  try {
    return await db.googleDocLink.count({ where: dateFilter });
  } catch (err) {
    if (!isMissingTableError(err)) throw err;
    return 0;
  }
}

async function countCollabSessions(
  db: PrismaClient,
  dateFilter: { createdAt: { gte: Date } },
): Promise<number> {
  if (!hasPrismaModel(db, "collaborationSession", "count")) {
    return 0;
  }
  return db.collaborationSession.count({ where: dateFilter });
}

// -- /api/admin/analytics -------------------------------------------------

export const analytics = withAdmin(async (req) => {
  const url = new URL(req.url);
  const range = parseRange(url.searchParams.get("range"));
  if (!range) {
    return bad("Invalid range. Use 7d, 30d, or 90d.");
  }

  const cacheKey = `analytics:${range}`;
  const now = Date.now();
  if (
    analyticsCache &&
    analyticsCache.key === cacheKey &&
    now - analyticsCache.at < CACHE_MS
  ) {
    return NextResponse.json(analyticsCache.payload, NO_STORE_HEADERS);
  }

  const since = sinceDate(range);
  const days = rangeToDays(range);
  const bucketKeys = buildDayBuckets(since, days);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const budgetUsd = parseFloat(process.env.LLM_MONTHLY_BUDGET_USD ?? "50");
  const startOfMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1,
  );

  const dateFilter = { createdAt: { gte: since } };
  const paidAtFilter = { paidAt: { gte: since } };
  const db = getAnalyticsDb();

  const [
    usersTotal,
    signupsInRange,
    byPlan,
    activeSubscriptionsTotal,
    paymentsInRange,
    allPaymentsDates,
    newUsersWithPayment,
    dau,
    wau,
    onboardingComplete,
    usersWithSchool,
    usersWithProfEmail,
    usersWithChat,
    featureSchools,
    featureProfEmails,
    featureSopVariants,
    featureChatMessages,
    featureDocuments,
    featureCollabSessions,
    featureGoogleDocLinks,
    llmByFeature,
    llmByModel,
    llmInRangeAgg,
    llmMonthAgg,
    llmDailyRows,
    topLlmUsers,
    staleFreeUsers,
    infra,
    links,
  ] = await Promise.all([
    db.user.count(),
    db.user.findMany({
      where: { createdAt: dateFilter.createdAt },
      select: { createdAt: true },
    }),
    db.user.groupBy({ by: ["planTier"], _count: { _all: true } }),
    db.user.count({
      where: {
        planTier: { not: "FREE" },
        OR: [
          { subscriptionStatus: "active" },
          { subscriptionStatus: "trialing" },
        ],
      },
    }),
    db.billingPayment.aggregate({
      where: { currency: "GHS", ...paidAtFilter },
      _sum: { amountMinor: true },
      _count: { _all: true },
    }),
    db.billingPayment.findMany({
      where: { currency: "GHS", ...paidAtFilter },
      select: { paidAt: true },
    }),
    db.user.count({
      where: {
        billingPayments: { some: { paidAt: paidAtFilter.paidAt } },
        createdAt: dateFilter.createdAt,
      },
    }),
    countDau(db),
    countDistinctActiveUsers(db, sevenDaysAgo),
    db.profile.count({
      where: { onboardingCompletedAt: { not: null } },
    }),
    db.school.findMany({ select: { userId: true }, distinct: ["userId"] }),
    db.profEmail.findMany({
      select: { userId: true },
      distinct: ["userId"],
    }),
    db.chatMessage.findMany({
      select: { userId: true },
      distinct: ["userId"],
    }),
    db.school.count({ where: dateFilter }),
    db.profEmail.count({ where: dateFilter }),
    db.sopVariant.count({ where: dateFilter }),
    db.chatMessage.count({ where: dateFilter }),
    db.document.count({ where: dateFilter }),
    countCollabSessions(db, dateFilter),
    countGoogleDocLinks(db, dateFilter),
    db.llmCostLog.groupBy({
      by: ["feature"],
      where: dateFilter,
      _count: { _all: true },
      _sum: { inputCost: true, outputCost: true },
    }),
    db.llmCostLog.groupBy({
      by: ["model"],
      where: dateFilter,
      _count: { _all: true },
      _sum: { inputCost: true, outputCost: true },
    }),
    db.llmCostLog.aggregate({
      where: dateFilter,
      _sum: { inputCost: true, outputCost: true },
      _count: { _all: true },
    }),
    db.llmCostLog.aggregate({
      where: { createdAt: { gte: startOfMonth } },
      _sum: { inputCost: true, outputCost: true },
    }),
    db.llmCostLog.findMany({
      where: dateFilter,
      select: { createdAt: true },
    }),
    db.llmCostLog.groupBy({
      by: ["userId"],
      where: dateFilter,
      _sum: { inputCost: true, outputCost: true },
      _count: { _all: true },
    }),
    db.user.findMany({
      where: {
        planTier: "FREE",
        schools: { some: {} },
        billingPayments: { none: {} },
      },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        _count: { select: { schools: true } },
      },
      orderBy: { createdAt: "asc" },
      take: 20,
    }),
    getCloudflareWorkerMetrics(days),
    Promise.resolve(getObservabilityLinks()),
  ]);

  const byPlanMap: Record<PlanTier, number> = { FREE: 0, PLUS: 0, PRO: 0 };
  for (const row of byPlan) byPlanMap[row.planTier] = row._count._all;

  const llmCostInRange =
    (llmInRangeAgg._sum.inputCost ?? 0) + (llmInRangeAgg._sum.outputCost ?? 0);
  const llmCostMonth =
    (llmMonthAgg._sum.inputCost ?? 0) + (llmMonthAgg._sum.outputCost ?? 0);

  const topLlmSorted = [...topLlmUsers]
    .sort(
      (a, b) =>
        (b._sum.inputCost ?? 0) +
        (b._sum.outputCost ?? 0) -
        ((a._sum.inputCost ?? 0) + (a._sum.outputCost ?? 0)),
    )
    .slice(0, 10);
  const topUserIds = topLlmSorted.map((r) => r.userId);
  const topUserRows =
    topUserIds.length > 0
      ? await db.user.findMany({
          where: { id: { in: topUserIds } },
          select: { id: true, email: true, name: true },
        })
      : [];
  const topUserById = new Map(topUserRows.map((u) => [u.id, u]));

  const payload = {
    range,
    generatedAt: new Date().toISOString(),
    growth: {
      usersTotal,
      signupsInRange: signupsInRange.length,
      signupsByDay: countByUtcDay(
        signupsInRange.map((u) => u.createdAt),
        bucketKeys,
      ),
      byPlan: byPlanMap,
      activeSubscriptionsTotal,
      newPaidUsers: newUsersWithPayment,
      revenueGhs: (paymentsInRange._sum.amountMinor ?? 0) / 100,
      paymentsCount: paymentsInRange._count._all,
      revenueByDay: countByUtcDay(
        allPaymentsDates.map((p) => p.paidAt),
        bucketKeys,
      ),
    },
    product: {
      dau,
      wau,
      activation: {
        signedUp: usersTotal,
        onboardingComplete,
        hasSchool: usersWithSchool.length,
        hasProfEmail: usersWithProfEmail.length,
        hasChat: usersWithChat.length,
      },
      features: {
        schools: featureSchools,
        profEmails: featureProfEmails,
        sopVariants: featureSopVariants,
        chatMessages: featureChatMessages,
        documents: featureDocuments,
        collabSessions: featureCollabSessions,
        googleDocLinks: featureGoogleDocLinks,
      },
      llmFeatures: llmByFeature.map((row) => ({
        feature: row.feature,
        calls: row._count._all,
        costUsd:
          Math.round(
            ((row._sum.inputCost ?? 0) + (row._sum.outputCost ?? 0)) * 10000,
          ) / 10000,
      })),
    },
    ai: {
      totalCostUsdRange: Math.round(llmCostInRange * 10000) / 10000,
      totalCostUsdMonth: Math.round(llmCostMonth * 10000) / 10000,
      budgetUsd,
      utilizationPctMonth:
        budgetUsd > 0
          ? Math.round((llmCostMonth / budgetUsd) * 1000) / 10
          : 0,
      callsInRange: llmInRangeAgg._count._all,
      callsByDay: countByUtcDay(
        llmDailyRows.map((r) => r.createdAt),
        bucketKeys,
      ),
      byModel: llmByModel.map((row) => ({
        model: row.model,
        calls: row._count._all,
        costUsd:
          Math.round(
            ((row._sum.inputCost ?? 0) + (row._sum.outputCost ?? 0)) * 10000,
          ) / 10000,
      })),
      topUsers: topLlmSorted.map((row) => {
        const u = topUserById.get(row.userId);
        return {
          userId: row.userId,
          email: u?.email ?? null,
          name: u?.name ?? null,
          calls: row._count._all,
          costUsd:
            Math.round(
              ((row._sum.inputCost ?? 0) + (row._sum.outputCost ?? 0)) * 10000,
            ) / 10000,
        };
      }),
    },
    sales: {
      staleFreeUsers: staleFreeUsers.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        schoolCount: u._count.schools,
        createdAt: u.createdAt.toISOString(),
      })),
    },
    infra,
    links,
  };

  analyticsCache = { key: cacheKey, at: now, payload };
  return NextResponse.json(payload, NO_STORE_HEADERS);
});
