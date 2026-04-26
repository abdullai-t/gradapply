import { z } from "zod";

import { prisma } from "@/lib/prisma";

import type { ToolDefinition } from "../types";
import { getCached, setCached } from "../cache";

// ---------------------------------------------------------------------------
// getSopVariant — current tailored SOP variant for a school
// ---------------------------------------------------------------------------

const sopVariantInput = z.object({ schoolId: z.string() });

const sopVariantOutput = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  masterText: z.string().nullable(),
}).nullable();

type SopVariantOutput = z.infer<typeof sopVariantOutput>;

export const getSopVariantTool: ToolDefinition<z.infer<typeof sopVariantInput>, SopVariantOutput> = {
  name: "getSopVariant",
  description:
    "Loads the saved SOP variant for a given school (title, body, and the master SOP text it was based on).",
  inputSchema: sopVariantInput,
  outputSchema: sopVariantOutput,
  cacheable: true,
  estimatedLatencyMs: 40,
  async execute(input, ctx): Promise<SopVariantOutput> {
    const cached = getCached<SopVariantOutput>(ctx, "getSopVariant", input);
    if (cached !== undefined) return cached;

    const variant = await prisma.sopVariant.findFirst({
      where: { schoolId: input.schoolId, userId: ctx.userId },
    });

    if (!variant) {
      setCached(ctx, "getSopVariant", input, null);
      return null;
    }

    const MAX = 6000;
    const result: SopVariantOutput = {
      id: variant.id,
      title: variant.title,
      body: variant.body.length > MAX ? `${variant.body.slice(0, MAX)}…` : variant.body,
      masterText: variant.masterText
        ? variant.masterText.length > MAX
          ? `${variant.masterText.slice(0, MAX)}…`
          : variant.masterText
        : null,
    };

    setCached(ctx, "getSopVariant", input, result);
    return result;
  },
};

// ---------------------------------------------------------------------------
// getMasterSop — master SOP from a specific document or variant
// ---------------------------------------------------------------------------

const masterSopInput = z.object({ schoolId: z.string().optional() });

const masterSopOutput = z.object({
  text: z.string(),
  source: z.string(),
}).nullable();

type MasterSopOutput = z.infer<typeof masterSopOutput>;

export const getMasterSopTool: ToolDefinition<z.infer<typeof masterSopInput>, MasterSopOutput> = {
  name: "getMasterSop",
  description: "Retrieves the master SOP text (the general-purpose statement the user wrote).",
  inputSchema: masterSopInput,
  outputSchema: masterSopOutput,
  cacheable: true,
  estimatedLatencyMs: 50,
  async execute(input, ctx): Promise<MasterSopOutput> {
    const cached = getCached<MasterSopOutput>(ctx, "getMasterSop", input);
    if (cached !== undefined) return cached;

    // Try from the variant's masterText first
    if (input.schoolId) {
      const variant = await prisma.sopVariant.findFirst({
        where: { schoolId: input.schoolId, userId: ctx.userId },
        select: { masterText: true },
      });
      if (variant?.masterText) {
        const result: MasterSopOutput = {
          text: variant.masterText,
          source: "sopVariant.masterText",
        };
        setCached(ctx, "getMasterSop", input, result);
        return result;
      }
    }

    // Try from any variant that has a masterText
    const anyVariant = await prisma.sopVariant.findFirst({
      where: { userId: ctx.userId, masterText: { not: null } },
      select: { masterText: true },
      orderBy: { updatedAt: "desc" },
    });

    if (anyVariant?.masterText) {
      const result: MasterSopOutput = {
        text: anyVariant.masterText,
        source: "sopVariant.masterText",
      };
      setCached(ctx, "getMasterSop", input, result);
      return result;
    }

    setCached(ctx, "getMasterSop", input, null);
    return null;
  },
};
