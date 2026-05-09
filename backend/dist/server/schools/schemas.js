// @ts-nocheck
import { z } from "zod";
export const createSchoolSchema = z.object({
    name: z.string().min(1),
    program: z.string().min(1),
    degree: z.string().min(1),
    country: z.string().nullable().optional(),
    term: z.nativeEnum(AdmissionTerm).nullable().optional(),
    deadline: z.union([z.string(), z.null()]).optional(),
    reminderAt: z.union([z.string(), z.null()]).optional(),
    reminderNote: z.string().nullable().optional(),
    status: z.nativeEnum(SchoolStatus).optional(),
    funding: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    portalUrl: z.string().nullable().optional(),
});
export const updateSchoolSchema = z.object({
    name: z.string().min(1).optional(),
    program: z.string().min(1).optional(),
    degree: z.string().min(1).optional(),
    country: z.string().nullable().optional(),
    term: z.nativeEnum(AdmissionTerm).nullable().optional(),
    deadline: z.union([z.string(), z.null()]).optional(),
    reminderAt: z.union([z.string(), z.null()]).optional(),
    reminderNote: z.string().nullable().optional(),
    status: z.nativeEnum(SchoolStatus).optional(),
    funding: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    portalUrl: z.string().nullable().optional(),
});
export const inferSchoolSchema = z.object({
    name: z.string().min(1).max(500),
    term: z.nativeEnum(AdmissionTerm).nullable().optional(),
});
