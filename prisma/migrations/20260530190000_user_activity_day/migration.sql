-- CreateTable
CREATE TABLE "UserActivityDay" (
    "userId" TEXT NOT NULL,
    "activeOn" DATE NOT NULL,

    CONSTRAINT "UserActivityDay_pkey" PRIMARY KEY ("userId","activeOn")
);

-- CreateIndex
CREATE INDEX "UserActivityDay_activeOn_idx" ON "UserActivityDay"("activeOn");

-- AddForeignKey
ALTER TABLE "UserActivityDay" ADD CONSTRAINT "UserActivityDay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
