import { z } from "zod";

export const artifactTypeSchema = z.enum([
  "SOP_VARIANT",
  "PROF_EMAIL",
  "CUSTOM_TEXT",
]);

export const createSessionSchema = z.object({
  artifactType: artifactTypeSchema,
  entityId: z.string().min(1).optional(),
  title: z.string().min(1).max(200).optional(),
  customBody: z.string().max(200_000).optional(),
  customTitle: z.string().max(200).optional(),
});

export const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(["COMMENTER", "EDITOR"]).default("COMMENTER"),
});

export const createGuestLinkSchema = z.object({
  label: z.string().max(80).optional(),
  expiresInDays: z.number().int().min(1).max(90).optional(),
});

export const revokeGuestLinkSchema = z.object({
  inviteId: z.string().min(1),
});

export const createCommentSchema = z.object({
  body: z.string().min(1).max(10_000),
  parentId: z.string().min(1).optional(),
  guestLabel: z.string().min(1).max(80).optional(),
});

export const updateSessionSchema = z.object({
  status: z.enum(["OPEN", "CLOSED"]).optional(),
  title: z.string().min(1).max(200).optional(),
  liveEnabled: z.boolean().optional(),
});

export const persistLiveBodySchema = z.object({
  body: z.string().max(200_000),
});
