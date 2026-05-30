-- AlterTable
ALTER TABLE "School" ADD COLUMN     "programUrl" TEXT,
ADD COLUMN     "department" TEXT,
ADD COLUMN     "college" TEXT,
ADD COLUMN     "primaryProfessor" TEXT,
ADD COLUMN     "backupProfessors" TEXT,
ADD COLUMN     "requiredMaterials" JSONB,
ADD COLUMN     "letterRecommenders" JSONB;
