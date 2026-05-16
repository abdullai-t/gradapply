import { PlanTier, UserRole } from "@prisma/client";
import { NextResponse } from "next/server";

import {
  canAssignRole,
  canManageRole,
  canManageTargetUser,
} from "@/lib/admin-auth";
import {
  BILLING_SETTING_KEYS,
  getAppSettingValue,
  setAppSettingValue,
} from "@/lib/app-settings";
import { getBillingAdminConfig } from "@/lib/billing-admin-config";
import { prisma } from "@/lib/prisma";
import { isTrustedMutationOrigin } from "@/lib/request-origin";

import { bad, forbidden, notFound, ok } from "../_responses";
import { withAdmin } from "../_with-admin";

import {
  updateConfigSchema,
  updateUserSchema,
} from "./schemas";

const PAGE_SIZE = 20;
const NO_STORE_HEADERS = { headers: { "Cache-Control": "no-store" } };

// -- /api/admin/overview -------------------------------------------------

export const overview = withAdmin(async (_req, { role: actorRole }) => {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    usersTotal,
    adminsTotal,
    superAdminsTotal,
    billingCustomersTotal,
    activeSubscriptionsTotal,
    newUsers7d,
    usageTotals,
    paymentsGhsTotal,
    paymentsGhs30d,
    byPlan,
    recentUsers,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: "ADMIN" } }),
    prisma.user.count({ where: { role: "SUPERADMIN" } }),
    prisma.user.count({
      where: { paystackCustomerId: { not: null } },
    }),
    prisma.user.count({
      where: {
        planTier: { not: "FREE" },
        OR: [
          { subscriptionStatus: "active" },
          { subscriptionStatus: "trialing" },
        ],
      },
    }),
    prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.user.aggregate({
      _sum: { aiUsageUsed: true, aiCreditsBalance: true },
    }),
    prisma.billingPayment.aggregate({
      where: { currency: "GHS" },
      _sum: { amountMinor: true },
      _count: { _all: true },
    }),
    prisma.billingPayment.aggregate({
      where: { currency: "GHS", paidAt: { gte: thirtyDaysAgo } },
      _sum: { amountMinor: true },
      _count: { _all: true },
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
  for (const row of byPlan) byPlanMap[row.planTier] = row._count._all;

  return NextResponse.json(
    {
      actorRole,
      metrics: {
        usersTotal,
        adminsTotal,
        superAdminsTotal,
        billingCustomersTotal,
        activeSubscriptionsTotal,
        newUsers7d,
        aiUsageUsedTotal: usageTotals._sum.aiUsageUsed ?? 0,
        aiCreditsBalanceTotal: usageTotals._sum.aiCreditsBalance ?? 0,
        paymentsCountTotal: paymentsGhsTotal._count._all,
        paymentsCount30d: paymentsGhs30d._count._all,
        revenueGhsTotal: (paymentsGhsTotal._sum.amountMinor ?? 0) / 100,
        revenueGhs30d: (paymentsGhs30d._sum.amountMinor ?? 0) / 100,
        byPlan: byPlanMap,
      },
      recentUsers: recentUsers.map((u) => ({
        ...u,
        createdAt: u.createdAt.toISOString(),
      })),
    },
    NO_STORE_HEADERS,
  );
});

// -- /api/admin/users ----------------------------------------------------

export const listUsers = withAdmin(async (req, { role: actorRole }) => {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const role = searchParams.get("role")?.trim();
  const pageRaw = Number(searchParams.get("page") ?? "1");
  const page =
    Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
  const skip = (page - 1) * PAGE_SIZE;

  const where = {
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { email: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(role && Object.values(UserRole).includes(role as UserRole)
      ? { role: role as UserRole }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      skip,
      take: PAGE_SIZE,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        planTier: true,
        subscriptionStatus: true,
        paystackCustomerId: true,
        aiUsageUsed: true,
        aiCreditsBalance: true,
        createdAt: true,
      },
    }),
    prisma.user.count({ where }),
  ]);

  return NextResponse.json(
    {
      page,
      pageSize: PAGE_SIZE,
      total,
      actorRole,
      users: rows.map((u) => ({
        ...u,
        createdAt: u.createdAt.toISOString(),
        hasPaystackCustomer: Boolean(u.paystackCustomerId),
      })),
    },
    NO_STORE_HEADERS,
  );
});

// -- /api/admin/users/[id] ----------------------------------------------

export const updateUser = withAdmin<{ id: string }>(
  async (req, { role: actorRole, params }) => {
    if (!isTrustedMutationOrigin(req)) return forbidden("Untrusted origin");

    const { id } = params;
    const parsed = updateUserSchema.safeParse(
      await req.json().catch(() => null),
    );
    if (!parsed.success) return bad(parsed.error.flatten());

    const existing = await prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true },
    });
    if (!existing) return notFound("User not found");

    if (parsed.data.role && parsed.data.role !== existing.role) {
      if (!canManageRole(actorRole))
        return forbidden("Only admins can change roles.");
      if (!canManageTargetUser(actorRole, existing.role))
        return forbidden("Only superadmins can modify superadmin accounts.");
      if (!canAssignRole(actorRole, parsed.data.role))
        return forbidden("Only superadmins can assign the SUPERADMIN role.");
      if (existing.role === "SUPERADMIN" && parsed.data.role !== "SUPERADMIN") {
        const superadminCount = await prisma.user.count({
          where: { role: "SUPERADMIN" },
        });
        if (superadminCount <= 1)
          return bad("Cannot remove the last superadmin role.");
      }
    }

    const patch: {
      planTier?: PlanTier;
      subscriptionStatus?: string | null;
      aiCreditsBalance?: { increment: number };
      aiUsageUsed?: number;
      role?: UserRole;
    } = {};

    if (parsed.data.planTier) patch.planTier = parsed.data.planTier;
    if (Object.hasOwn(parsed.data, "subscriptionStatus")) {
      patch.subscriptionStatus = parsed.data.subscriptionStatus ?? null;
    }
    if (parsed.data.aiCreditsDelta && parsed.data.aiCreditsDelta !== 0) {
      patch.aiCreditsBalance = { increment: parsed.data.aiCreditsDelta };
    }
    if (parsed.data.resetMonthlyUsage) patch.aiUsageUsed = 0;
    if (parsed.data.role) patch.role = parsed.data.role;

    if (Object.keys(patch).length === 0) return ok({ ok: true, changed: false });

    const user = await prisma.user.update({
      where: { id },
      data: patch,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        planTier: true,
        subscriptionStatus: true,
        aiUsageUsed: true,
        aiCreditsBalance: true,
        paystackCustomerId: true,
        createdAt: true,
      },
    });

    return ok({
      ok: true,
      changed: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        planTier: user.planTier,
        subscriptionStatus: user.subscriptionStatus,
        aiUsageUsed: user.aiUsageUsed,
        aiCreditsBalance: user.aiCreditsBalance,
        createdAt: user.createdAt.toISOString(),
        hasPaystackCustomer: Boolean(user.paystackCustomerId),
      },
    });
  },
);

export const deleteUser = withAdmin<{ id: string }>(
  async (req, { role: actorRole, params }) => {
    if (!isTrustedMutationOrigin(req)) return forbidden("Untrusted origin");

    const target = await prisma.user.findUnique({
      where: { id: params.id },
      select: { id: true, role: true },
    });
    if (!target) return notFound("User not found");
    if (!canManageTargetUser(actorRole, target.role))
      return forbidden("Only superadmins can delete superadmin accounts.");
    if (target.role === "SUPERADMIN") {
      const superadminCount = await prisma.user.count({
        where: { role: "SUPERADMIN" },
      });
      if (superadminCount <= 1)
        return bad("Cannot delete the last superadmin account.");
    }

    await prisma.user.delete({ where: { id: params.id } });
    return ok({ ok: true });
  },
);

// -- /api/admin/config --------------------------------------------------

export const getConfig = withAdmin(async (_req, { role: actorRole }) => {
  const cfg = await getBillingAdminConfig();
  const paystackSecretKeyRaw = await getAppSettingValue(
    BILLING_SETTING_KEYS.paystackSecretKey,
  );

  return NextResponse.json(
    {
      actorRole,
      settings: {
        paystackSecretKeySet: Boolean(
          paystackSecretKeyRaw || cfg.paystackSecretKey,
        ),
        paystackCurrency: cfg.paystackCurrency,
        paystackPlanCodePlus: cfg.paystackPlanCodePlus ?? "",
        paystackPlanCodePro: cfg.paystackPlanCodePro ?? "",
        paystackPlanCodeProRenewal: cfg.paystackPlanCodeProRenewal ?? "",
        paystackPlanCodePlusRenewal: cfg.paystackPlanCodePlusRenewal ?? "",
        paystackAmountCreditsMinor: cfg.paystackAmountCreditsMinor,
        displayPriceProGhs: cfg.displayPriceProGhs,
        displayPricePlusGhs: cfg.displayPricePlusGhs,
        displayPriceCreditsPackGhs: cfg.displayPriceCreditsPackGhs,
        creditUnitPriceGhs: cfg.creditUnitPriceGhs,
        displayPriceProRenewalGhs: cfg.displayPriceProRenewalGhs,
        displayPricePlusRenewalGhs: cfg.displayPricePlusRenewalGhs,
        paystackAmountCvDeepReviewMinor: cfg.paystackAmountCvDeepReviewMinor,
        paystackAmountSopDetailedCritiqueMinor:
          cfg.paystackAmountSopDetailedCritiqueMinor,
        allowanceFree: cfg.allowance.FREE,
        allowancePlus: cfg.allowance.PLUS,
        allowancePro: cfg.allowance.PRO,
        freeSignupCredits: cfg.freeSignupCredits,
        freeMonthlyCreditsGrant: cfg.freeMonthlyCreditsGrant,
        creditsPackSize: cfg.creditsPackSize,
      },
    },
    NO_STORE_HEADERS,
  );
});

export const patchConfig = withAdmin(async (req) => {
  if (!isTrustedMutationOrigin(req)) return forbidden("Untrusted origin");

  const parsed = updateConfigSchema.safeParse(
    await req.json().catch(() => null),
  );
  if (!parsed.success) return bad(parsed.error.flatten());

  const updates = parsed.data;
  const ops: Promise<void>[] = [];

  const put = (key: string, value: string, secret = false) => {
    ops.push(setAppSettingValue({ key, value, secret }));
  };

  if (updates.paystackSecretKey)
    put(
      BILLING_SETTING_KEYS.paystackSecretKey,
      updates.paystackSecretKey,
      true,
    );
  if (updates.paystackCurrency)
    put(
      BILLING_SETTING_KEYS.paystackCurrency,
      updates.paystackCurrency.toUpperCase(),
    );
  if (updates.paystackPlanCodePlus)
    put(
      BILLING_SETTING_KEYS.paystackPlanCodePlus,
      updates.paystackPlanCodePlus,
    );
  if (updates.paystackPlanCodePro)
    put(BILLING_SETTING_KEYS.paystackPlanCodePro, updates.paystackPlanCodePro);
  if (updates.paystackPlanCodeProRenewal)
    put(
      BILLING_SETTING_KEYS.paystackPlanCodeProRenewal,
      updates.paystackPlanCodeProRenewal,
    );
  if (updates.paystackPlanCodePlusRenewal)
    put(
      BILLING_SETTING_KEYS.paystackPlanCodePlusRenewal,
      updates.paystackPlanCodePlusRenewal,
    );
  if (updates.paystackAmountCreditsMinor != null)
    put(
      BILLING_SETTING_KEYS.paystackAmountCreditsMinor,
      String(updates.paystackAmountCreditsMinor),
    );
  if (updates.displayPriceProGhs != null)
    put(BILLING_SETTING_KEYS.displayPriceProGhs, String(updates.displayPriceProGhs));
  if (updates.displayPricePlusGhs != null)
    put(
      BILLING_SETTING_KEYS.displayPricePlusGhs,
      String(updates.displayPricePlusGhs),
    );
  if (updates.displayPriceCreditsPackGhs != null)
    put(
      BILLING_SETTING_KEYS.displayPriceCreditsPackGhs,
      String(updates.displayPriceCreditsPackGhs),
    );
  if (updates.creditUnitPriceGhs != null)
    put(BILLING_SETTING_KEYS.creditUnitPriceGhs, String(updates.creditUnitPriceGhs));
  if (updates.displayPriceProRenewalGhs != null)
    put(
      BILLING_SETTING_KEYS.displayPriceProRenewalGhs,
      String(updates.displayPriceProRenewalGhs),
    );
  if (updates.displayPricePlusRenewalGhs != null)
    put(
      BILLING_SETTING_KEYS.displayPricePlusRenewalGhs,
      String(updates.displayPricePlusRenewalGhs),
    );
  if (updates.paystackAmountCvDeepReviewMinor != null)
    put(
      BILLING_SETTING_KEYS.paystackAmountCvDeepReviewMinor,
      String(updates.paystackAmountCvDeepReviewMinor),
    );
  if (updates.paystackAmountSopDetailedCritiqueMinor != null)
    put(
      BILLING_SETTING_KEYS.paystackAmountSopDetailedCritiqueMinor,
      String(updates.paystackAmountSopDetailedCritiqueMinor),
    );
  if (updates.allowanceFree != null)
    put(BILLING_SETTING_KEYS.allowanceFree, String(updates.allowanceFree));
  if (updates.allowancePlus != null)
    put(BILLING_SETTING_KEYS.allowancePlus, String(updates.allowancePlus));
  if (updates.allowancePro != null)
    put(BILLING_SETTING_KEYS.allowancePro, String(updates.allowancePro));
  if (updates.freeSignupCredits != null)
    put(
      BILLING_SETTING_KEYS.freeSignupCredits,
      String(updates.freeSignupCredits),
    );
  if (updates.freeMonthlyCreditsGrant != null)
    put(
      BILLING_SETTING_KEYS.freeMonthlyCreditsGrant,
      String(updates.freeMonthlyCreditsGrant),
    );
  if (updates.creditsPackSize != null)
    put(BILLING_SETTING_KEYS.creditsPackSize, String(updates.creditsPackSize));

  if (ops.length === 0) return ok({ ok: true, changed: false });

  try {
    await Promise.all(ops);
  } catch (error) {
    const msg =
      error instanceof Error ? error.message : "Failed to persist settings.";
    return bad(msg, 500);
  }
  return ok({ ok: true, changed: true });
});
