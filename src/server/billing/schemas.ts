import { z } from "zod";

export const checkoutBodySchema = z.object({
  tier: z.enum(["plus", "pro", "credits"]),
});

export const emailSchema = z.string().trim().email();
