import { EmailStatus } from "@prisma/client";
import { z } from "zod";

import { zPrismaRecordId } from "@/lib/prisma-record-id-zod";

const optionalHttpUrl = z
  .union([z.string().url().max(2000), z.literal(""), z.null()])
  .optional()
  .transform((v) => (v === "" || v == null ? null : v));

export const createProfEmailSchema = z
  .object({
    profName: z.string().min(1).optional().nullable(),
    profEmail: z
      .union([z.string().email(), z.literal(""), z.null()])
      .optional()
      .transform((v) => (v === "" ? null : v)),
    university: z.string().min(1).optional().nullable(),
    profileUrl: optionalHttpUrl,
    researchArea: z.string().nullable().optional(),
    emailSubject: z.string().nullable().optional(),
    emailBody: z.string().nullable().optional(),
    status: z.nativeEnum(EmailStatus).optional(),
    notes: z.string().nullable().optional(),
  })
  .refine(
    (data) =>
      Boolean(data.profileUrl?.trim()) ||
      (Boolean(data.profName?.trim()) &&
        Boolean(data.university?.trim())),
    {
      message:
        "Provide a faculty profile URL, or both professor name and university.",
      path: ["profileUrl"],
    },
  );

export const updateProfEmailSchema = z.object({
  profName: z
    .union([z.string().min(1), z.literal(""), z.null()])
    .optional()
    .transform((v) => (v === "" ? null : v)),
  profEmail: z
    .union([z.string().email(), z.literal(""), z.null()])
    .optional()
    .transform((v) => (v === "" ? null : v)),
  university: z
    .union([z.string().min(1), z.literal(""), z.null()])
    .optional()
    .transform((v) => (v === "" ? null : v)),
  profileUrl: optionalHttpUrl,
  researchArea: z.string().nullable().optional(),
  emailSubject: z.string().nullable().optional(),
  emailBody: z.string().nullable().optional(),
  status: z.nativeEnum(EmailStatus).optional(),
  sentAt: z.string().datetime().nullable().optional(),
  repliedAt: z.string().datetime().nullable().optional(),
  lastReplySnippet: z.string().nullable().optional(),
  suggestedReplyDraft: z.string().nullable().optional(),
  followUpCount: z.number().int().min(0).optional(),
  notes: z.string().nullable().optional(),
});

export const analyzeReplyBodySchema = z.object({
  replyText: z.string().min(20).max(80000),
});

export const fromUrlBodySchema = z
  .object({
    profileUrl: z.string().url().max(2000),
    profName: z.string().min(1).max(200).optional(),
    university: z.string().min(1).max(200).optional(),
  })
  .refine(
    (data) => {
      const hasName = Boolean(data.profName?.trim());
      const hasUni = Boolean(data.university?.trim());
      return (hasName && hasUni) || (!hasName && !hasUni);
    },
    {
      message: "Provide both professor name and university, or leave both empty.",
      path: ["profName"],
    },
  );

export const sendViaGmailBodySchema = z.object({
  attachmentDocumentIds: z.array(z.string().min(1)).max(6).optional(),
});

export const discoverBodySchema = z.object({
  profileUrl: z.string().url().max(2000),
  schoolIds: z.array(zPrismaRecordId).min(1).max(12),
});

export const discoverBySchoolsBodySchema = z.object({
  schoolIds: z.array(zPrismaRecordId).min(1).max(12),
});
