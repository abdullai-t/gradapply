-- Broad WHERE/JOIN index coverage for API query patterns.
-- Uses IF NOT EXISTS to remain safe across environments.

-- Text-search acceleration used by admin user search (contains + case-insensitive).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Ownership and list patterns on School.
CREATE INDEX IF NOT EXISTS "School_id_userId_idx"
  ON "School"("id", "userId");
CREATE INDEX IF NOT EXISTS "School_userId_name_idx"
  ON "School"("userId", "name");

-- Ownership and list patterns on ProfEmail.
CREATE INDEX IF NOT EXISTS "ProfEmail_id_userId_idx"
  ON "ProfEmail"("id", "userId");
CREATE INDEX IF NOT EXISTS "ProfEmail_userId_profileUrl_idx"
  ON "ProfEmail"("userId", "profileUrl");

-- Ownership and list patterns on Document.
CREATE INDEX IF NOT EXISTS "Document_id_userId_idx"
  ON "Document"("id", "userId");
CREATE INDEX IF NOT EXISTS "Document_userId_type_idx"
  ON "Document"("userId", "type");

-- Ownership and lookup patterns on ContentVersion.
CREATE INDEX IF NOT EXISTS "ContentVersion_id_userId_idx"
  ON "ContentVersion"("id", "userId");
CREATE INDEX IF NOT EXISTS "ContentVersion_parentVersionId_idx"
  ON "ContentVersion"("parentVersionId");
CREATE INDEX IF NOT EXISTS "ContentVersion_userId_entityType_createdAt_idx"
  ON "ContentVersion"("userId", "entityType", "createdAt");

-- Ownership checks on SopVariant.
CREATE INDEX IF NOT EXISTS "SopVariant_id_userId_idx"
  ON "SopVariant"("id", "userId");

-- Join / FK helper indexes (Postgres does not auto-create FK indexes).
CREATE INDEX IF NOT EXISTS "Account_userId_idx"
  ON "Account"("userId");
CREATE INDEX IF NOT EXISTS "Session_userId_idx"
  ON "Session"("userId");
CREATE INDEX IF NOT EXISTS "Connector_userId_idx"
  ON "Connector"("userId");
CREATE INDEX IF NOT EXISTS "ContentVersion_userId_idx"
  ON "ContentVersion"("userId");
CREATE INDEX IF NOT EXISTS "ProfEmail_userId_idx"
  ON "ProfEmail"("userId");
CREATE INDEX IF NOT EXISTS "School_userId_idx"
  ON "School"("userId");
CREATE INDEX IF NOT EXISTS "ChatMessage_userId_idx"
  ON "ChatMessage"("userId");
CREATE INDEX IF NOT EXISTS "Document_userId_idx"
  ON "Document"("userId");
CREATE INDEX IF NOT EXISTS "SopVariant_userId_idx"
  ON "SopVariant"("userId");

-- Admin filtering / aggregates on User.
CREATE INDEX IF NOT EXISTS "User_role_idx"
  ON "User"("role");
CREATE INDEX IF NOT EXISTS "User_createdAt_idx"
  ON "User"("createdAt");
CREATE INDEX IF NOT EXISTS "User_planTier_idx"
  ON "User"("planTier");
CREATE INDEX IF NOT EXISTS "User_subscriptionStatus_idx"
  ON "User"("subscriptionStatus");
CREATE INDEX IF NOT EXISTS "User_planTier_subscriptionStatus_idx"
  ON "User"("planTier", "subscriptionStatus");

-- Trigram indexes for case-insensitive contains search in admin users endpoint.
CREATE INDEX IF NOT EXISTS "User_name_trgm_idx"
  ON "User" USING GIN ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "User_email_trgm_idx"
  ON "User" USING GIN ("email" gin_trgm_ops);
