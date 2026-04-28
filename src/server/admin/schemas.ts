import { PlanTier, UserRole } from "@prisma/client";
import { z } from "zod";

const keyRegex = /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/;

export const updateUserSchema = z.object({
  planTier: z.nativeEnum(PlanTier).optional(),
  subscriptionStatus: z.string().trim().max(80).nullable().optional(),
  aiCreditsDelta: z.number().int().min(-100000).max(100000).optional(),
  resetMonthlyUsage: z.boolean().optional(),
  role: z.nativeEnum(UserRole).optional(),
});

export const createFlagSchema = z.object({
  key: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(
      keyRegex,
      "Use lowercase letters/numbers with optional '-' or '_' separators.",
    ),
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(400).nullable().optional(),
  enabled: z.boolean().optional(),
});

export const patchFlagSchema = z.object({
  key: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(
      keyRegex,
      "Use lowercase letters/numbers with optional '-' or '_' separators.",
    )
    .optional(),
  name: z.string().trim().min(2).max(100).optional(),
  description: z.string().trim().max(400).nullable().optional(),
  enabled: z.boolean().optional(),
});

export const updateConfigSchema = z.object({
  stripeSecretKey: z.string().trim().min(1).optional(),
  stripeWebhookSecret: z.string().trim().min(1).optional(),
  paystackSecretKey: z.string().trim().min(1).optional(),
  paystackCurrency: z.string().trim().min(3).max(10).optional(),
  stripePricePlus: z.string().trim().min(1).optional(),
  stripePricePro: z.string().trim().min(1).optional(),
  stripePriceCreditsPack: z.string().trim().min(1).optional(),
  paystackPlanCodePlus: z.string().trim().min(1).optional(),
  paystackPlanCodePro: z.string().trim().min(1).optional(),
  paystackAmountCreditsMinor: z.number().int().min(0).optional(),
  allowanceFree: z.number().int().min(0).optional(),
  allowancePlus: z.number().int().min(0).optional(),
  allowancePro: z.number().int().min(0).optional(),
  creditsPackSize: z.number().int().min(1).optional(),
});
