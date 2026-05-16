import { AdmissionTerm, SchoolStatus } from "@prisma/client";
import { z } from "zod";

import { zPrismaRecordId } from "@/lib/prisma-record-id-zod";

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

const schoolIdentitySchema = z.object({
  name: z.string().min(1).max(500),
  program: z.string().min(1).max(200).optional(),
});

export const recommendSchoolsSchema = z.object({
  /** Schools already shown/skipped this modal session — exclude on refresh. */
  sessionExclude: z.array(schoolIdentitySchema).max(80).optional(),
});

export const inferSchoolSchema = z
  .object({
    name: z.string().min(1).max(500).optional(),
    schoolId: zPrismaRecordId.optional(),
    term: z.nativeEnum(AdmissionTerm).nullable().optional(),
  })
  .refine((d) => Boolean(d.name?.trim()) || Boolean(d.schoolId), {
    message: "Provide name or schoolId.",
    path: ["name"],
  });
