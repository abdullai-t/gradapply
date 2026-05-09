-- CreateEnum
CREATE TYPE "PlanTier" AS ENUM ('FREE', 'PLUS', 'PRO');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "planTier" "PlanTier" NOT NULL DEFAULT 'FREE',
ADD COLUMN "stripeCustomerId" TEXT,
ADD COLUMN "stripeSubscriptionId" TEXT,
ADD COLUMN "stripePriceId" TEXT,
ADD COLUMN "subscriptionStatus" TEXT,
ADD COLUMN "currentPeriodEnd" TIMESTAMP(3),
ADD COLUMN "aiUsageUsed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "aiCreditsBalance" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "User_stripeCustomerId_key" ON "User"("stripeCustomerId");

-- CreateTable
CREATE TABLE "StripeEventLog" (
    "eventId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StripeEventLog_pkey" PRIMARY KEY ("eventId")
);
