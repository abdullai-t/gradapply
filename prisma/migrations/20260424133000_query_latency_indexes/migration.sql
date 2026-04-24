-- Query-latency indexes for common user-scoped list and timeline queries.
CREATE INDEX IF NOT EXISTS "School_userId_updatedAt_idx"
  ON "School"("userId", "updatedAt");

CREATE INDEX IF NOT EXISTS "School_userId_deadline_idx"
  ON "School"("userId", "deadline");

CREATE INDEX IF NOT EXISTS "School_userId_reminderAt_idx"
  ON "School"("userId", "reminderAt");

CREATE INDEX IF NOT EXISTS "School_userId_status_deadline_idx"
  ON "School"("userId", "status", "deadline");

CREATE INDEX IF NOT EXISTS "ProfEmail_userId_updatedAt_idx"
  ON "ProfEmail"("userId", "updatedAt");

CREATE INDEX IF NOT EXISTS "ProfEmail_userId_status_updatedAt_idx"
  ON "ProfEmail"("userId", "status", "updatedAt");

CREATE INDEX IF NOT EXISTS "ChatMessage_userId_mode_createdAt_idx"
  ON "ChatMessage"("userId", "mode", "createdAt");

CREATE INDEX IF NOT EXISTS "ChatMessage_userId_createdAt_idx"
  ON "ChatMessage"("userId", "createdAt");

CREATE INDEX IF NOT EXISTS "Document_userId_createdAt_idx"
  ON "Document"("userId", "createdAt");

-- Helps country-interest containment checks if/when array operators are used.
CREATE INDEX IF NOT EXISTS "Profile_countriesOfInterest_gin_idx"
  ON "Profile" USING GIN ("countriesOfInterest");
