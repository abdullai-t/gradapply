-- Add optional school scoping for chat messages (SOP studio isolation).
ALTER TABLE "ChatMessage"
ADD COLUMN IF NOT EXISTS "schoolId" TEXT;

-- Indexes for scoped history queries (with and without school context).
CREATE INDEX IF NOT EXISTS "ChatMessage_userId_mode_schoolId_createdAt_idx"
ON "ChatMessage"("userId", "mode", "schoolId", "createdAt");

CREATE INDEX IF NOT EXISTS "ChatMessage_userId_mode_createdAt_idx"
ON "ChatMessage"("userId", "mode", "createdAt");

-- Keep existing chats when a school is deleted.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ChatMessage_schoolId_fkey'
  ) THEN
    ALTER TABLE "ChatMessage"
    ADD CONSTRAINT "ChatMessage_schoolId_fkey"
    FOREIGN KEY ("schoolId")
    REFERENCES "School"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
  END IF;
END
$$;
