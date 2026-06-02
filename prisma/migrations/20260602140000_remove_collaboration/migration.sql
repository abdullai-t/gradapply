-- Remove collaboration-session Google Doc links before enum change.
DELETE FROM "GoogleDocLink" WHERE "entityType" = 'COLLABORATION_SESSION';

-- Drop collaboration tables (FK order).
DROP TABLE IF EXISTS "CollaborationComment";
DROP TABLE IF EXISTS "CollaborationGuestInvite";
DROP TABLE IF EXISTS "CollaborationMember";
DROP TABLE IF EXISTS "CollaborationArtifact";
DROP TABLE IF EXISTS "CollaborationSession";

DROP TYPE IF EXISTS "CollaborationSessionStatus";
DROP TYPE IF EXISTS "CollaborationMemberRole";
DROP TYPE IF EXISTS "CollaborationArtifactType";

-- Remove COLLABORATION_SESSION from GoogleDocLinkEntityType.
CREATE TYPE "GoogleDocLinkEntityType_new" AS ENUM ('SOP_VARIANT', 'PROF_EMAIL', 'DOCUMENT_TEXT');

ALTER TABLE "GoogleDocLink"
  ALTER COLUMN "entityType" TYPE "GoogleDocLinkEntityType_new"
  USING ("entityType"::text::"GoogleDocLinkEntityType_new");

DROP TYPE "GoogleDocLinkEntityType";
ALTER TYPE "GoogleDocLinkEntityType_new" RENAME TO "GoogleDocLinkEntityType";

DELETE FROM "FeatureFlag" WHERE "key" = 'collaboration';
