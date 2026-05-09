-- CreateTable
CREATE TABLE "PaystackEventLog" (
    "reference" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaystackEventLog_pkey" PRIMARY KEY ("reference")
);

-- AlterTable
ALTER TABLE "User" ADD COLUMN "paystackCustomerId" TEXT,
ADD COLUMN "paystackSubscriptionCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_paystackCustomerId_key" ON "User"("paystackCustomerId");
