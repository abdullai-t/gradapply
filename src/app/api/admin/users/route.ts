import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";

import { requireElevatedUser } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

const PAGE_SIZE = 20;

export async function GET(req: Request) {
  const actor = await requireElevatedUser();
  if (!actor) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const role = searchParams.get("role")?.trim();
  const pageRaw = Number(searchParams.get("page") ?? "1");
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
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
        stripeCustomerId: true,
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
      actorRole: actor.role,
      users: rows.map((u) => ({
        ...u,
        createdAt: u.createdAt.toISOString(),
        hasStripeCustomer: Boolean(u.stripeCustomerId),
        hasPaystackCustomer: Boolean(u.paystackCustomerId),
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
