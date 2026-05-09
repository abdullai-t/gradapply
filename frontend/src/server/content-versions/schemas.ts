import { ContentEntityType } from "@/types/enums";
import { z } from "zod";

export const entityTypeSchema = z.nativeEnum(ContentEntityType);

export const createContentVersionSchema = z.object({
  entityType: entityTypeSchema,
  entityId: z.string().min(1).nullable().optional(),
  label: z.string().min(1).max(500),
  parentVersionId: z.string().nullable().optional(),
  /** Professor email — overrides DB when saving an unsaved draft. */
  emailSubject: z.string().nullable().optional(),
  emailBody: z.string().nullable().optional(),
  /** Freeform text snapshot (SOP paragraph, notes, etc.). */
  body: z.string().nullable().optional(),
  /** Explicit file URL (optional; otherwise derived from Document). */
  fileUrl: z.string().url().nullable().optional(),
});
