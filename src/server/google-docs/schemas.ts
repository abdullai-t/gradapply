import { z } from "zod";

export const entityTypeSchema = z.enum([
  "SOP_VARIANT",
  "PROF_EMAIL",
  "COLLABORATION_SESSION",
  "DOCUMENT_TEXT",
]);

export const linkBodySchema = z.object({
  entityType: entityTypeSchema,
  entityId: z.string().min(1),
});
