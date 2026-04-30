import { z } from "zod";

export const checkoutBodySchema = z.object({
  tier: z.enum(["plus", "pro", "credits", "cv_review", "sop_critique"]),
  renewal: z.boolean().optional().default(false),
  creditsAmount: z.union([z.literal(10), z.literal(20), z.literal(50), z.literal(100)]).optional(),
});

export const emailSchema = z.string().trim().email();
