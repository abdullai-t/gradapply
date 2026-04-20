-- CreateEnum
CREATE TYPE "ReplyIntent" AS ENUM ('INTERESTED', 'NEUTRAL', 'DECLINED', 'UNKNOWN');

-- Rename legacy column
ALTER TABLE "ProfEmail" RENAME COLUMN "replySnippet" TO "lastReplySnippet";

-- AlterTable
ALTER TABLE "ProfEmail" ADD COLUMN "replyIntent" "ReplyIntent",
ADD COLUMN "suggestedReplyDraft" TEXT,
ADD COLUMN "replyRationale" TEXT,
ADD COLUMN "lastClassifiedAt" TIMESTAMP(3);
