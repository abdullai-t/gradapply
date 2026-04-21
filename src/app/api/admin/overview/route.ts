import { NextResponse } from "next/server";
import { PlanTier } from "@prisma/client";

import { requireElevatedUser } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const actor = await requireElevatedUser();
  if (!actor) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    usersTotal,
    adminsTotal,
    superAdminsTotal,
    billingCustomersTotal,
    activeSubscriptionsTotal,
    newUsers7d,
    usageTotals,
    byPlan,
    recentUsers,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: "ADMIN" } }),
    prisma.user.count({ where: { role: "SUPERADMIN" } }),
    prisma.user.count({
      where: {
        OR: [
          { stripeCustomerId: { not: null } },
          { paystackCustomerId: { not: null } },
        ],
      },
    }),
    prisma.user.count({
      where: {
        planTier: { not: "FREE" },
        OR: [{ subscriptionStatus: "active" }, { subscriptionStatus: "trialing" }],
      },
    }),
    prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.user.aggregate({
      _sum: { aiUsageUsed: true, aiCreditsBalance: true },
    }),
    prisma.user.groupBy({
      by: ["planTier"],
      _count: { _all: true },
    }),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        planTier: true,
        createdAt: true,
      },
    }),
  ]);

  const byPlanMap: Record<PlanTier, number> = { FREE: 0, PLUS: 0, PRO: 0 };
  for (const row of byPlan) {
    byPlanMap[row.planTier] = row._count._all;
  }

  return NextResponse.json(
    {
      actorRole: actor.role,
      metrics: {
        usersTotal,
        adminsTotal,
        superAdminsTotal,
        billingCustomersTotal,
        activeSubscriptionsTotal,
        newUsers7d,
        aiUsageUsedTotal: usageTotals._sum.aiUsageUsed ?? 0,
        aiCreditsBalanceTotal: usageTotals._sum.aiCreditsBalance ?? 0,
        byPlan: byPlanMap,
      },
      recentUsers: recentUsers.map((u) => ({
        ...u,
        createdAt: u.createdAt.toISOString(),
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
