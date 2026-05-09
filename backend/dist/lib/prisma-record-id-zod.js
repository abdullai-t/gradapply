// @ts-nocheck
import { z } from "zod";
/**
 * Validates Prisma string @id values (cuid / cuid2-style) from clients.
 * Rejects oversized strings used for DB / parser abuse.
 */
export const zPrismaRecordId = z
    .string()
    .min(20)
    .max(36)
    .regex(/^[a-z0-9]+$/i);
