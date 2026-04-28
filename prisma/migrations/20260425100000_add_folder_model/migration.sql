-- Add Folder model and link Documents to optional folders.
-- B3: User-defined document taxonomy. Documents without a folder remain
-- visible via the existing Category cards (which bucket by DocumentKind).

-- AlterTable: optional folderId on Document
ALTER TABLE "Document" ADD COLUMN "folderId" TEXT;

-- CreateTable: Folder
CREATE TABLE "Folder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Folder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Folder_userId_createdAt_idx" ON "Folder"("userId", "createdAt");

-- CreateIndex (unique folder name per user)
CREATE UNIQUE INDEX "Folder_userId_name_key" ON "Folder"("userId", "name");

-- CreateIndex (fast filter by folder)
CREATE INDEX "Document_userId_folderId_idx" ON "Document"("userId", "folderId");

-- AddForeignKey: Document.folderId -> Folder.id (SetNull keeps doc when folder is deleted)
ALTER TABLE "Document" ADD CONSTRAINT "Document_folderId_fkey"
    FOREIGN KEY ("folderId") REFERENCES "Folder"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: Folder.userId -> User.id
ALTER TABLE "Folder" ADD CONSTRAINT "Folder_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
