// @ts-nocheck
import { z } from "zod";

export const FOLDER_NAME_MAX = 60;
export const FOLDER_LIMIT_PER_USER = 50;

export const createFolderSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Folder name is required")
    .max(FOLDER_NAME_MAX),
  icon: z.string().trim().max(40).nullable().optional(),
  color: z.string().trim().max(40).nullable().optional(),
});

export const patchFolderSchema = z.object({
  name: z.string().trim().min(1).max(FOLDER_NAME_MAX).optional(),
  icon: z.string().trim().max(40).nullable().optional(),
  color: z.string().trim().max(40).nullable().optional(),
});
