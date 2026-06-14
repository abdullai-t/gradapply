import { z } from "zod";

export const registerPushTokenSchema = z.object({
  token: z.string().min(20).max(512),
  platform: z.literal("web").default("web"),
});

export const unregisterPushTokenSchema = z.object({
  token: z.string().min(20).max(512).optional(),
});
