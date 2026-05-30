import { prisma } from "@/lib/prisma";
import { requireWritableAccount } from "@/lib/plan-gates";

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
  const readOnly = await requireWritableAccount(userId);
  if (readOnly) return readOnly;

  const json = await req.json().catch(() => null);
  const parsed = updateProfileSchema.safeParse(json);
  if (!parsed.success) return bad({ error: parsed.error.flatten() });

  const { onboardingCompletedAt, onboardingRecommendSeenAt, ...rest } =
    parsed.data;
  const data = {
    ...rest,
    ...(onboardingCompletedAt !== undefined
      ? {
          onboardingCompletedAt:
            onboardingCompletedAt === null || onboardingCompletedAt === ""
              ? null
              : new Date(onboardingCompletedAt),
        }
      : {}),
    ...(onboardingRecommendSeenAt !== undefined
      ? {
          onboardingRecommendSeenAt:
            onboardingRecommendSeenAt === null ||
            onboardingRecommendSeenAt === ""
              ? null
              : new Date(onboardingRecommendSeenAt),
        }
      : {}),
  };

  const profile = await prisma.profile.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });

  return ok(profile);
});
