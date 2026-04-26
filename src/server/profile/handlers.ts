import { prisma } from "@/lib/prisma";

import { bad, ok } from "../_responses";
import { withAuth } from "../_with-auth";

import { updateProfileSchema } from "./schemas";

export const GET = withAuth(async (_req, { userId }) => {
  let profile = await prisma.profile.findUnique({
    where: { userId },
  });

  if (!profile) {
    profile = await prisma.profile.create({
      data: { userId },
    });
  }

  return ok(profile);
});

export const PATCH = withAuth(async (req, { userId }) => {
  const json = await req.json().catch(() => null);
  const parsed = updateProfileSchema.safeParse(json);
  if (!parsed.success) return bad({ error: parsed.error.flatten() });

  const profile = await prisma.profile.upsert({
    where: { userId },
    create: { userId, ...parsed.data },
    update: parsed.data,
  });

  return ok(profile);
});
