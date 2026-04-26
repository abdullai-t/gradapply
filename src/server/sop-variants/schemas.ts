import { z } from "zod";

const MASTER_TEXT_MAX = 30_000;
/** ~100k chars — keeps DB/UI reasonable for a single essay field. */
const VARIANT_BODY_MAX = 100_000;

export const createSopVariantSchema = z
  .object({
    schoolId: z.string().min(1),
    masterDocumentId: z.string().optional(),
    masterText: z.string().optional(),
    title: z.string().min(1).max(200).optional(),
  })
  .refine(
    (d) =>
      Boolean(d.masterDocumentId?.trim()) ||
      (d.masterText?.trim().length ?? 0) >= 80,
    {
      message:
        "Provide masterDocumentId (library SOP) or masterText (at least 80 characters).",
    },
  )
  .refine(
    (d) => {
      const hasDoc = Boolean(d.masterDocumentId?.trim());
      const hasText = (d.masterText?.trim().length ?? 0) >= 80;
      return !(hasDoc && hasText);
    },
    {
      message:
        "Send only one of masterDocumentId or masterText (not both).",
    },
  )
  .refine(
    (d) => (d.masterText?.length ?? 0) <= MASTER_TEXT_MAX,
    { message: `masterText must be at most ${MASTER_TEXT_MAX} characters.` },
  );

export const updateSopVariantSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  body: z.string().min(1).max(VARIANT_BODY_MAX).optional(),
});

export const SOP_MASTER_TEXT_MAX = MASTER_TEXT_MAX;
export const SOP_VARIANT_BODY_MAX = VARIANT_BODY_MAX;
