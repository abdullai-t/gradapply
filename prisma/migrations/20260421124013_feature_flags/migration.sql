-- AlterTable
ALTER TABLE "ProfEmail" ADD COLUMN     "profileUrl" TEXT,
ALTER COLUMN "profName" DROP NOT NULL,
ALTER COLUMN "university" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "passwordHash" TEXT;
