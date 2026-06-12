import { getTestPrisma, migrateTestDatabase } from "../helpers/prisma-test-db";

async function main() {
  migrateTestDatabase();
  const prisma = getTestPrisma();
  const freeId = process.env.E2E_FREE_USER_ID ?? "e2e-free-user";
  const plusId = process.env.E2E_PLUS_USER_ID ?? "e2e-plus-user";

  for (const row of [
    {
      id: freeId,
      email: "free-e2e@test.local",
      name: "E2E Free",
      planTier: "FREE" as const,
      aiCreditsBalance: 5,
    },
    {
      id: plusId,
      email: "plus-e2e@test.local",
      name: "E2E Plus",
      planTier: "PLUS" as const,
      aiCreditsBalance: 0,
      aiUsageUsed: 0,
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  ]) {
    await prisma.user.upsert({
      where: { id: row.id },
      update: row,
      create: row,
    });
    await prisma.profile.upsert({
      where: { userId: row.id },
      update: {
        targetDegree: "PhD",
        countriesOfInterest: ["US"],
        onboardingCompletedAt: new Date(),
      },
      create: {
        userId: row.id,
        targetDegree: "PhD",
        countriesOfInterest: ["US"],
        onboardingCompletedAt: new Date(),
      },
    });
  }

  console.log("E2E seed complete:", { freeId, plusId });
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
