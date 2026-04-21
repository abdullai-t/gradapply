import { NextResponse } from "next/server";
import { PlanTier, UserRole } from "@prisma/client";
import { z } from "zod";

import {
  canAssignRole,
  canManageRole,
  canManageTargetUser,
  requireElevatedUser,
} from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { isTrustedMutationOrigin } from "@/lib/request-origin";

const updateSchema = z.object({
  planTier: z.nativeEnum(PlanTier).optional(),
  subscriptionStatus: z.string().trim().max(80).nullable().optional(),
  aiCreditsDelta: z.number().int().min(-100000).max(100000).optional(),
  resetMonthlyUsage: z.boolean().optional(),
  role: z.nativeEnum(UserRole).optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  if (!isTrustedMutationOrigin(req)) {
    return NextResponse.json({ error: "Untrusted origin" }, { status: 403 });
  }

  const actor = await requireElevatedUser();
  if (!actor) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;

  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (parsed.data.role && parsed.data.role !== existing.role) {
    if (!canManageRole(actor.role)) {
      return NextResponse.json(
        { error: "Only admins can change roles." },
        { status: 403 },
      );
    }
    if (!canManageTargetUser(actor.role, existing.role)) {
      return NextResponse.json(
        { error: "Only superadmins can modify superadmin accounts." },
        { status: 403 },
      );
    }
    if (!canAssignRole(actor.role, parsed.data.role)) {
      return NextResponse.json(
        { error: "Only superadmins can assign the SUPERADMIN role." },
        { status: 403 },
      );
    }
    if (existing.role === "SUPERADMIN" && parsed.data.role !== "SUPERADMIN") {
      const superadminCount = await prisma.user.count({
        where: { role: "SUPERADMIN" },
      });
      if (superadminCount <= 1) {
        return NextResponse.json(
          { error: "Cannot remove the last superadmin role." },
          { status: 400 },
        );
      }
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
  if (parsed.data.resetMonthlyUsage) {
    patch.aiUsageUsed = 0;
  }
  if (parsed.data.role) {
    patch.role = parsed.data.role;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: true, changed: false });
  }

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
      stripeCustomerId: true,
      paystackCustomerId: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
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
      hasStripeCustomer: Boolean(user.stripeCustomerId),
      hasPaystackCustomer: Boolean(user.paystackCustomerId),
    },
  });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  if (!isTrustedMutationOrigin(_req)) {
    return NextResponse.json({ error: "Untrusted origin" }, { status: 403 });
  }

  const actor = await requireElevatedUser();
  if (!actor) {
    return NextResponse.json(
      { error: "Only admins can delete users." },
      { status: 403 },
    );
  }

  const { id } = await ctx.params;
  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true },
  });
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (!canManageTargetUser(actor.role, target.role)) {
    return NextResponse.json(
      { error: "Only superadmins can delete superadmin accounts." },
      { status: 403 },
    );
  }
  if (target.role === "SUPERADMIN") {
    const superadminCount = await prisma.user.count({
      where: { role: "SUPERADMIN" },
    });
    if (superadminCount <= 1) {
      return NextResponse.json(
        { error: "Cannot delete the last superadmin account." },
        { status: 400 },
      );
    }
  }

  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
