-- CreateEnum
CREATE TYPE "AdmissionTerm" AS ENUM ('FALL', 'SPRING', 'SUMMER');

-- AlterTable
ALTER TABLE "School" ADD COLUMN "term" "AdmissionTerm";
