-- Persist master SOP text on tailored variants (paste, upload, or extracted from library doc).
ALTER TABLE "SopVariant" ADD COLUMN IF NOT EXISTS "masterText" TEXT;
