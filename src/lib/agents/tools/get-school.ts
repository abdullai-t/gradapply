import { z } from "zod";

import { prisma } from "@/lib/prisma";
import {
  normalizeLetterRecommenders,
  normalizeRequiredMaterials,
} from "@/lib/school-tracker-defaults";

import type { ToolDefinition } from "../types";
import { getCached, setCached } from "../cache";

// ---------------------------------------------------------------------------
// getSchool — single school by ID
// ---------------------------------------------------------------------------

const getSchoolInput = z.object({ schoolId: z.string() });

const schoolShape = z.object({
  id: z.string(),
  name: z.string(),
  program: z.string(),
  degree: z.string(),
  country: z.string().nullable(),
  deadline: z.string().nullable(),
  status: z.string(),
  funding: z.string().nullable(),
  applicationFee: z.string().nullable(),
  notes: z.string().nullable(),
  portalUrl: z.string().nullable(),
  programUrl: z.string().nullable(),
  department: z.string().nullable(),
  college: z.string().nullable(),
  primaryProfessor: z.string().nullable(),
  requiredMaterialLabels: z.array(z.string()),
  lettersRequired: z.number().nullable(),
}).nullable();

type SchoolOutput = z.infer<typeof schoolShape>;

function schoolToToolOutput(
  school: NonNullable<Awaited<ReturnType<typeof prisma.school.findFirst>>>,
): SchoolOutput {
  const materials = normalizeRequiredMaterials(school.requiredMaterials);
  const letters = normalizeLetterRecommenders(school.letterRecommenders);
  return {
    id: school.id,
    name: school.name,
    program: school.program,
    degree: school.degree,
    country: school.country,
    deadline: school.deadline?.toISOString().slice(0, 10) ?? null,
    status: school.status,
    funding: school.funding,
    applicationFee: school.applicationFee,
    notes: school.notes,
    portalUrl: school.portalUrl,
    programUrl: school.programUrl,
    department: school.department,
    college: school.college,
    primaryProfessor: school.primaryProfessor,
    requiredMaterialLabels: materials.map((m) => m.label),
    lettersRequired: letters.length > 0 ? letters.length : null,
  };
}

export const getSchoolTool: ToolDefinition<z.infer<typeof getSchoolInput>, SchoolOutput> = {
  name: "getSchool",
  description: "Loads a single school from the user's school list by its ID.",
  inputSchema: getSchoolInput,
  outputSchema: schoolShape,
  cacheable: true,
  estimatedLatencyMs: 40,
  async execute(input, ctx): Promise<SchoolOutput> {
    const cached = getCached<SchoolOutput>(ctx, "getSchool", input);
    if (cached !== undefined) return cached;

    const school = await prisma.school.findFirst({
      where: { id: input.schoolId, userId: ctx.userId },
    });

    if (!school) {
      setCached(ctx, "getSchool", input, null);
      return null;
    }

    const result = schoolToToolOutput(school);

    setCached(ctx, "getSchool", input, result);
    return result;
  },
};

// ---------------------------------------------------------------------------
// getSchoolByName — fuzzy match on user's school list
// ---------------------------------------------------------------------------

const getSchoolByNameInput = z.object({ name: z.string() });

export const getSchoolByNameTool: ToolDefinition<z.infer<typeof getSchoolByNameInput>, SchoolOutput> = {
  name: "getSchoolByName",
  description: "Finds a school by name (fuzzy match) from the user's school list.",
  inputSchema: getSchoolByNameInput,
  outputSchema: schoolShape,
  cacheable: true,
  estimatedLatencyMs: 60,
  async execute(input, ctx): Promise<SchoolOutput> {
    const cached = getCached<SchoolOutput>(ctx, "getSchoolByName", input);
    if (cached !== undefined) return cached;

    const schools = await prisma.school.findMany({
      where: { userId: ctx.userId },
    });

    const target = input.name.toLowerCase().trim();
    const match = schools.find((s) => s.name.toLowerCase().includes(target) || target.includes(s.name.toLowerCase()));

    if (!match) {
      setCached(ctx, "getSchoolByName", input, null);
      return null;
    }

    const result = schoolToToolOutput(match);

    setCached(ctx, "getSchoolByName", input, result);
    return result;
  },
};

// ---------------------------------------------------------------------------
// getExistingSchools — all schools for user
// ---------------------------------------------------------------------------

const emptyInput = z.object({});

const schoolListShape = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    program: z.string(),
    degree: z.string(),
    country: z.string().nullable(),
  }),
);

type SchoolListOutput = z.infer<typeof schoolListShape>;

export const getExistingSchoolsTool: ToolDefinition<z.infer<typeof emptyInput>, SchoolListOutput> = {
  name: "getExistingSchools",
  description: "Lists all schools on the user's application tracking list (id, name, program, degree, country).",
  inputSchema: emptyInput,
  outputSchema: schoolListShape,
  cacheable: true,
  estimatedLatencyMs: 50,
  async execute(_input, ctx): Promise<SchoolListOutput> {
    const cached = getCached<SchoolListOutput>(ctx, "getExistingSchools", {});
    if (cached !== undefined) return cached;

    const schools = await prisma.school.findMany({
      where: { userId: ctx.userId },
      select: { id: true, name: true, program: true, degree: true, country: true },
      orderBy: { updatedAt: "desc" },
    });

    const result: SchoolListOutput = schools.map((s) => ({
      id: s.id,
      name: s.name,
      program: s.program,
      degree: s.degree,
      country: s.country,
    }));

    setCached(ctx, "getExistingSchools", {}, result);
    return result;
  },
};
