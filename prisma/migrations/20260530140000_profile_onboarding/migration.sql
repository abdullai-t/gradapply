-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "onboardingCompletedAt" TIMESTAMP(3),
ADD COLUMN     "onboardingRecommendSeenAt" TIMESTAMP(3);

-- Backfill: users who already have schools skip forced onboarding
UPDATE "Profile" p
SET "onboardingCompletedAt" = NOW()
WHERE p."onboardingCompletedAt" IS NULL
  AND EXISTS (
    SELECT 1 FROM "School" s WHERE s."userId" = p."userId"
  );
