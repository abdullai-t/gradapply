-- CreateEnum
CREATE TYPE "GoogleDocLinkEntityType" AS ENUM ('SOP_VARIANT', 'PROF_EMAIL', 'COLLABORATION_SESSION', 'DOCUMENT_TEXT');

-- CreateTable
CREATE TABLE "GoogleDocLink" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entityType" "GoogleDocLinkEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "googleFileId" TEXT NOT NULL,
    "googleDocUrl" TEXT NOT NULL,
    "headRevisionId" TEXT,
    "driveModifiedTime" TIMESTAMP(3),
    "watchChannelId" TEXT,
    "watchResourceId" TEXT,
    "watchExpiresAt" TIMESTAMP(3),
    "watchChannelToken" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "lastSyncSource" TEXT,
    "lastSyncError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleDocLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GoogleDocLink_entityType_entityId_key" ON "GoogleDocLink"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "GoogleDocLink_userId_idx" ON "GoogleDocLink"("userId");

-- CreateIndex
CREATE INDEX "GoogleDocLink_googleFileId_idx" ON "GoogleDocLink"("googleFileId");

-- CreateIndex
CREATE INDEX "GoogleDocLink_watchExpiresAt_idx" ON "GoogleDocLink"("watchExpiresAt");

-- AddForeignKey
ALTER TABLE "GoogleDocLink" ADD CONSTRAINT "GoogleDocLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
