-- CreateEnum
CREATE TYPE "CollaborationSessionStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "CollaborationMemberRole" AS ENUM ('OWNER', 'COMMENTER', 'EDITOR');

-- CreateEnum
CREATE TYPE "CollaborationArtifactType" AS ENUM ('SOP_VARIANT', 'PROF_EMAIL', 'CUSTOM_TEXT');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'COLLAB_INVITE';

-- CreateTable
CREATE TABLE "CollaborationSession" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "CollaborationSessionStatus" NOT NULL DEFAULT 'OPEN',
    "schoolId" TEXT,
    "liveEnabled" BOOLEAN NOT NULL DEFAULT false,
    "liveRoomId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollaborationSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollaborationArtifact" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "type" "CollaborationArtifactType" NOT NULL,
    "sourceEntityId" TEXT,
    "snapshot" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollaborationArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollaborationMember" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "CollaborationMemberRole" NOT NULL,
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "joinedAt" TIMESTAMP(3),

    CONSTRAINT "CollaborationMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollaborationGuestInvite" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "label" TEXT,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollaborationGuestInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollaborationComment" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "authorUserId" TEXT,
    "guestLabel" TEXT,
    "body" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollaborationComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CollaborationSession_ownerId_updatedAt_idx" ON "CollaborationSession"("ownerId", "updatedAt");

-- CreateIndex
CREATE INDEX "CollaborationSession_status_updatedAt_idx" ON "CollaborationSession"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "CollaborationArtifact_sessionId_version_idx" ON "CollaborationArtifact"("sessionId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "CollaborationMember_sessionId_userId_key" ON "CollaborationMember"("sessionId", "userId");

-- CreateIndex
CREATE INDEX "CollaborationMember_userId_sessionId_idx" ON "CollaborationMember"("userId", "sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "CollaborationGuestInvite_tokenHash_key" ON "CollaborationGuestInvite"("tokenHash");

-- CreateIndex
CREATE INDEX "CollaborationGuestInvite_sessionId_revokedAt_idx" ON "CollaborationGuestInvite"("sessionId", "revokedAt");

-- CreateIndex
CREATE INDEX "CollaborationComment_sessionId_createdAt_idx" ON "CollaborationComment"("sessionId", "createdAt");

-- AddForeignKey
ALTER TABLE "CollaborationSession" ADD CONSTRAINT "CollaborationSession_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollaborationSession" ADD CONSTRAINT "CollaborationSession_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollaborationArtifact" ADD CONSTRAINT "CollaborationArtifact_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CollaborationSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollaborationMember" ADD CONSTRAINT "CollaborationMember_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CollaborationSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollaborationMember" ADD CONSTRAINT "CollaborationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollaborationGuestInvite" ADD CONSTRAINT "CollaborationGuestInvite_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CollaborationSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollaborationComment" ADD CONSTRAINT "CollaborationComment_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CollaborationSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollaborationComment" ADD CONSTRAINT "CollaborationComment_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollaborationComment" ADD CONSTRAINT "CollaborationComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "CollaborationComment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
