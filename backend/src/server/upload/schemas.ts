// @ts-nocheck
import { z } from "zod";

export const presignBodySchema = z.object({
  filename: z.string().min(1),
  contentType: z.string().min(1),
});
