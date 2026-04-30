-- Pricing model rollout foundation:
-- - account access mode for read-only on expiry
-- - lifetime free usage counters
-- - monthly AI usage reset marker

CREATE TYPE "AccountAccessMode" AS ENUM ('FULL', 'READ_ONLY');

ALTER TABLE "User"
ADD COLUMN "accessMode" "AccountAccessMode" NOT NULL DEFAULT 'FULL',
ADD COLUMN "accessReadOnlySince" TIMESTAMP(3),
ADD COLUMN "aiUsageMonth" TEXT,
ADD COLUMN "freeEmailGenUsed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "freeSopPreviewUsed" INTEGER NOT NULL DEFAULT 0;
