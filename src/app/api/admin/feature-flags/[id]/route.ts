import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { requireElevatedUser } from "@/lib/admin-auth";
import { clearFeatureFlagCache } from "@/lib/feature-flags";
import { prisma } from "@/lib/prisma";
import { isTrustedMutationOrigin } from "@/lib/request-origin";

const keyRegex = /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/;

const patchSchema = z.object({
  key: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(
      keyRegex,
      "Use lowercase letters/numbers with optional '-' or '_' separators.",
    )
    .optional(),
  name: z.string().trim().min(2).max(100).optional(),
  description: z.string().trim().max(400).nullable().optional(),
  enabled: z.boolean().optional(),
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
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.featureFlag.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Feature flag not found." }, { status: 404 });
  }

  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ ok: true, changed: false });
  }

  try {
    const flag = await prisma.featureFlag.update({
      where: { id },
      data: {
        ...(parsed.data.key ? { key: parsed.data.key.toLowerCase() } : {}),
        ...(parsed.data.name ? { name: parsed.data.name } : {}),
        ...(Object.hasOwn(parsed.data, "description")
          ? { description: parsed.data.description?.trim() || null }
          : {}),
        ...(Object.hasOwn(parsed.data, "enabled")
          ? { enabled: parsed.data.enabled }
          : {}),
      },
    });
    clearFeatureFlagCache(existing.key);
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
          { error: "Could not update feature flag. Key may already exist." },
          { status: 409 },
        );
      }
    }
    return NextResponse.json({ error: "Could not update feature flag." }, { status: 500 });
  }
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
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const existing = await prisma.featureFlag.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Feature flag not found." }, { status: 404 });
  }

  await prisma.featureFlag.delete({ where: { id } });
  clearFeatureFlagCache(existing.key);
  return NextResponse.json({ ok: true });
}
