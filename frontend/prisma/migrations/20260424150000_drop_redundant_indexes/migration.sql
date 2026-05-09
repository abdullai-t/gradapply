-- Dedupe pass: remove indexes that are redundant with PKs, unique constraints,
-- or existing left-prefix composite indexes.

-- Redundant with PK(id) lookups.
DROP INDEX IF EXISTS "School_id_userId_idx";
DROP INDEX IF EXISTS "ProfEmail_id_userId_idx";
DROP INDEX IF EXISTS "Document_id_userId_idx";
DROP INDEX IF EXISTS "ContentVersion_id_userId_idx";
DROP INDEX IF EXISTS "SopVariant_id_userId_idx";

-- Redundant single-column userId indexes where left-prefix composite indexes exist.
DROP INDEX IF EXISTS "School_userId_idx";
DROP INDEX IF EXISTS "ProfEmail_userId_idx";
DROP INDEX IF EXISTS "ChatMessage_userId_idx";
DROP INDEX IF EXISTS "Document_userId_idx";
DROP INDEX IF EXISTS "ContentVersion_userId_idx";
DROP INDEX IF EXISTS "Connector_userId_idx";
DROP INDEX IF EXISTS "SopVariant_userId_idx";
