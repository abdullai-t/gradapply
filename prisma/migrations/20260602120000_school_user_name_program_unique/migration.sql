-- Dedupe schools per user before adding composite unique (import upsert).
DELETE FROM "School" s1
USING "School" s2
WHERE s1."userId" = s2."userId"
  AND s1.name = s2.name
  AND s1.program = s2.program
  AND s1."createdAt" > s2."createdAt";

CREATE UNIQUE INDEX "School_userId_name_program_key" ON "School"("userId", "name", "program");
