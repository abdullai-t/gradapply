import { z } from "zod";

export const chatModeSchema = z.enum([
  "sop",
  "email",
  "feedback",
]);

export const sendMessageSchema = z.object({
  message: z.string().min(1),
  mode: chatModeSchema.optional().default("sop"),
  /// Scopes the chat to a specific school (SOP studio). When set, the chat
  /// agent loads school + saved variant + master text into context.
  schoolId: z.string().min(1).optional(),
  stream: z.boolean().optional().default(false),
});
