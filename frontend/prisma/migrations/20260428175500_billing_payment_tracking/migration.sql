CREATE TYPE "BillingProvider" AS ENUM ('STRIPE', 'PAYSTACK');
CREATE TYPE "BillingPaymentKind" AS ENUM (
  'PLAN_PURCHASE',
  'CREDITS_PACK',
  'CV_DEEP_REVIEW',
  'SOP_DETAILED_CRITIQUE'
);

CREATE TABLE "BillingPayment" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "provider" "BillingProvider" NOT NULL,
  "providerReference" TEXT NOT NULL,
  "kind" "BillingPaymentKind" NOT NULL,
  "tier" "PlanTier",
  "amountMinor" INTEGER,
  "currency" TEXT,
  "paidAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "BillingPayment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BillingPayment_provider_providerReference_key"
  ON "BillingPayment"("provider", "providerReference");

CREATE INDEX "BillingPayment_userId_paidAt_idx"
  ON "BillingPayment"("userId", "paidAt");

ALTER TABLE "BillingPayment"
  ADD CONSTRAINT "BillingPayment_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
