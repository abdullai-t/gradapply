import { z } from "zod";

import { prisma } from "@/lib/prisma";

import type { AgentContext, ToolDefinition } from "../types";
import { getCached, setCached } from "../cache";

const inputSchema = z.object({});

const outputSchema = z.object({
  name: z.string().nullable(),
  email: z.string().nullable(),
  targetDegree: z.string().nullable(),
  focusArea: z.string().nullable(),
  greScore: z.string().nullable(),
  greVerbal: z.number().nullable(),
  greQuant: z.number().nullable(),
  greAWA: z.number().nullable(),
  undergradSchool: z.string().nullable(),
  undergradDegree: z.string().nullable(),
  undergradGPA: z.number().nullable(),
  yearsExperience: z.string().nullable(),
  researchInterests: z.string().nullable(),
  countriesOfInterest: z.array(z.string()),
  schoolTierInterests: z.array(z.string()),
  bio: z.string().nullable(),
}).nullable();

type ProfileOutput = z.infer<typeof outputSchema>;

export const getProfileTool: ToolDefinition<z.infer<typeof inputSchema>, ProfileOutput> = {
  name: "getProfile",
  description:
    "Loads the applicant's full profile including academic background, research interests, GRE scores, and bio.",
  inputSchema,
  outputSchema,
  cacheable: true,
  estimatedLatencyMs: 50,
  async execute(_input: z.infer<typeof inputSchema>, ctx: AgentContext): Promise<ProfileOutput> {
    const cached = getCached<ProfileOutput>(ctx, "getProfile", {});
    if (cached !== undefined) return cached;

    const user = await prisma.user.findUnique({
      where: { id: ctx.userId },
      include: { profile: true },
    });

    if (!user) {
      setCached(ctx, "getProfile", {}, null);
      return null;
    }

    const result: ProfileOutput = {
      name: user.name ?? null,
      email: user.email ?? null,
      targetDegree: user.profile?.targetDegree ?? null,
      focusArea: user.profile?.focusArea ?? null,
      greScore: user.profile?.greScore ?? null,
      greVerbal: user.profile?.greVerbal ?? null,
      greQuant: user.profile?.greQuant ?? null,
      greAWA: user.profile?.greAWA ?? null,
      undergradSchool: user.profile?.undergradSchool ?? null,
      undergradDegree: user.profile?.undergradDegree ?? null,
      undergradGPA: user.profile?.undergradGPA ?? null,
      yearsExperience: user.profile?.yearsExperience ?? null,
      researchInterests: user.profile?.researchInterests ?? null,
      countriesOfInterest: user.profile?.countriesOfInterest ?? [],
      schoolTierInterests: user.profile?.schoolTierInterests ?? [],
      bio: user.profile?.bio ?? null,
    };

    setCached(ctx, "getProfile", {}, result);
    return result;
  },
};
