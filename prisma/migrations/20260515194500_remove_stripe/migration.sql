-- Remove Stripe integration; billing is Paystack-only.

DROP TABLE IF EXISTS "StripeEventLog";

UPDATE "BillingPayment" SET "provider" = 'PAYSTACK' WHERE "provider"::text = 'STRIPE';

ALTER TABLE "User" DROP COLUMN IF EXISTS "stripeCustomerId";
ALTER TABLE "User" DROP COLUMN IF EXISTS "stripeSubscriptionId";
ALTER TABLE "User" DROP COLUMN IF EXISTS "stripePriceId";

ALTER TABLE "BillingPayment" ALTER COLUMN "provider" TYPE TEXT USING ("provider"::text);
DROP TYPE "BillingProvider";
CREATE TYPE "BillingProvider" AS ENUM ('PAYSTACK');
ALTER TABLE "BillingPayment"
  ALTER COLUMN "provider" TYPE "BillingProvider" USING ("provider"::"BillingProvider");
