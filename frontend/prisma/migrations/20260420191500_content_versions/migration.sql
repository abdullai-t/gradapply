-- CreateEnum
CREATE TYPE "ContentEntityType" AS ENUM ('SOP', 'CV', 'PROF_EMAIL', 'OTHER');

-- CreateTable
CREATE TABLE "ContentVersion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entityType" "ContentEntityType" NOT NULL,
    "entityId" TEXT,
    "label" TEXT NOT NULL,
    "body" TEXT,
    "fileUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "parentVersionId" TEXT,

    CONSTRAINT "ContentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContentVersion_userId_entityType_entityId_idx" ON "ContentVersion"("userId", "entityType", "entityId");

-- AddForeignKey
ALTER TABLE "ContentVersion" ADD CONSTRAINT "ContentVersion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContentVersion" ADD CONSTRAINT "ContentVersion_parentVersionId_fkey" FOREIGN KEY ("parentVersionId") REFERENCES "ContentVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
