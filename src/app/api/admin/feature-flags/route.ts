import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { requireElevatedUser } from "@/lib/admin-auth";
import { clearFeatureFlagCache } from "@/lib/feature-flags";
import { prisma } from "@/lib/prisma";
import { isTrustedMutationOrigin } from "@/lib/request-origin";

const keyRegex = /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/;

const createSchema = z.object({
  key: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(
      keyRegex,
      "Use lowercase letters/numbers with optional '-' or '_' separators.",
    ),
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(400).nullable().optional(),
  enabled: z.boolean().optional(),
});

export async function GET() {
  const actor = await requireElevatedUser();
  if (!actor) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const flags = await prisma.featureFlag.findMany({
    orderBy: [{ updatedAt: "desc" }, { key: "asc" }],
  });

  return NextResponse.json(
    {
      actorRole: actor.role,
      flags: flags.map((f) => ({
        ...f,
        createdAt: f.createdAt.toISOString(),
        updatedAt: f.updatedAt.toISOString(),
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(req: Request) {
  if (!isTrustedMutationOrigin(req)) {
    return NextResponse.json({ error: "Untrusted origin" }, { status: 403 });
  }

  const actor = await requireElevatedUser();
  if (!actor) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const flag = await prisma.featureFlag.create({
      data: {
        key: parsed.data.key.toLowerCase(),
        name: parsed.data.name,
        description: parsed.data.description?.trim() || null,
        enabled: parsed.data.enabled ?? false,
      },
    });
    clearFeatureFlagCache(flag.key);
    return NextResponse.json({
      ok: true,
      flag: {
        ...flag,
        createdAt: flag.createdAt.toISOString(),
        updatedAt: flag.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return NextResponse.json(
          { error: "Feature flag key already exists." },
          { status: 409 },
        );
      }
    }
    return NextResponse.json(
      { error: "Could not create feature flag." },
      { status: 500 },
    );
  }
}
