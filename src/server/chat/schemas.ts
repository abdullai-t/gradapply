import { z } from "zod";

export const chatModeSchema = z.enum([
  "grammar",
  "sop",
  "email",
  "feedback",
  "general",
]);

export const sendMessageSchema = z.object({
  message: z.string().min(1),
  mode: chatModeSchema.optional().default("general"),
  /// Scopes the chat to a specific school (SOP studio). When set, the chat
  /// agent loads school + saved variant + master text into context.
  schoolId: z.string().min(1).optional(),
});
