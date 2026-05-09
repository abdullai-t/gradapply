// @ts-nocheck
import { z } from "zod";
const optionalHttpUrl = z
    .union([z.string().url().max(2000), z.literal(""), z.null()])
    .optional()
    .transform((v) => (v === "" || v == null ? null : v));
export const createEmailSchema = z
    .object({
    professorName: z.string().min(1).optional().nullable(),
    professorEmail: z.union([z.string().email(), z.literal("")]).optional(),
    university: z.string().min(1).optional().nullable(),
    profileUrl: optionalHttpUrl,
    researchArea: z.string().optional().nullable(),
    emailSubject: z.string().optional().nullable(),
    emailBody: z.string().optional().nullable(),
    status: z.nativeEnum(EmailStatus).optional(),
    notes: z.string().optional().nullable(),
})
    .refine((d) => Boolean(d.profileUrl?.trim()) ||
    (Boolean(d.professorName?.trim()) && Boolean(d.university?.trim())), {
    message: "Provide a profile URL, or both professor name and university.",
    path: ["profileUrl"],
});
export const patchEmailSchema = z
    .object({
    professorName: z.string().min(1).optional(),
    professorEmail: z
        .union([z.string().email(), z.literal(""), z.null()])
        .optional(),
    university: z.string().min(1).optional(),
    profileUrl: optionalHttpUrl,
    researchArea: z.string().min(1).optional(),
    emailSubject: z.string().min(1).optional(),
    emailBody: z.string().min(1).optional(),
    status: z.nativeEnum(EmailStatus).optional(),
    notes: z.string().nullable().optional(),
    sentAt: z.string().nullable().optional(),
    repliedAt: z.string().nullable().optional(),
    lastReplySnippet: z.string().nullable().optional(),
    followUpCount: z.number().int().min(0).optional(),
    markReplied: z.boolean().optional(),
})
    .strict();
