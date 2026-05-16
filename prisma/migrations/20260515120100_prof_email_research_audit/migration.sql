-- Cached professor research audit (LLM extraction).
ALTER TABLE "ProfEmail" ADD COLUMN IF NOT EXISTS "researchAudit" JSONB;
