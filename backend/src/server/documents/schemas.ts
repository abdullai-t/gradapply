// @ts-nocheck
import { z } from "zod";

export const docTypes = z.enum([
  "cv",
  "transcript",
  "gre",
  "sop_draft",
  "other",
]);

export const createDocumentSchema = z.object({
  name: z.string().min(1),
  type: docTypes,
  url: z.string().url(),
  size: z.number().int().positive().nullable().optional(),
  folderId: z.string().nullable().optional(),
});

export const patchDocumentSchema = z.object({
  /// `null` removes the document from any folder; a string moves it.
  folderId: z.string().nullable().optional(),
  name: z.string().trim().min(1).max(255).optional(),
});

export const uploadKindSchema = docTypes;
