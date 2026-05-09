// @ts-nocheck
import { z } from "zod";

import { COUNTRY_OPTIONS } from "@/lib/country-options";
import { DEGREE_OPTIONS, PROGRAM_OPTIONS } from "@/lib/grad-options";
import { getColdEmailGuidePlain } from "@/lib/cold-email-guide";

import type { ToolDefinition } from "../types";

const emptyInput = z.object({});

// ---------------------------------------------------------------------------
// getCountryOptions
// ---------------------------------------------------------------------------

const countryOutput = z.array(z.string());

export const getCountryOptionsTool: ToolDefinition<z.infer<typeof emptyInput>, string[]> = {
  name: "getCountryOptions",
  description: "Returns the curated list of country options for school forms.",
  inputSchema: emptyInput,
  outputSchema: countryOutput,
  cacheable: true,
  estimatedLatencyMs: 0,
  async execute(): Promise<string[]> {
    return [...COUNTRY_OPTIONS];
  },
};

// ---------------------------------------------------------------------------
// getProgramOptions
// ---------------------------------------------------------------------------

const programOutput = z.array(z.string());

export const getProgramOptionsTool: ToolDefinition<z.infer<typeof emptyInput>, string[]> = {
  name: "getProgramOptions",
  description: "Returns the curated list of graduate program options.",
  inputSchema: emptyInput,
  outputSchema: programOutput,
  cacheable: true,
  estimatedLatencyMs: 0,
  async execute(): Promise<string[]> {
    return [...PROGRAM_OPTIONS];
  },
};

// ---------------------------------------------------------------------------
// getDegreeOptions
// ---------------------------------------------------------------------------

const degreeOutput = z.array(z.string());

export const getDegreeOptionsTool: ToolDefinition<z.infer<typeof emptyInput>, string[]> = {
  name: "getDegreeOptions",
  description: "Returns the curated list of graduate degree options.",
  inputSchema: emptyInput,
  outputSchema: degreeOutput,
  cacheable: true,
  estimatedLatencyMs: 0,
  async execute(): Promise<string[]> {
    return [...DEGREE_OPTIONS];
  },
};

// ---------------------------------------------------------------------------
// getColdEmailGuide
// ---------------------------------------------------------------------------

const guideOutput = z.string();

export const getColdEmailGuideTool: ToolDefinition<z.infer<typeof emptyInput>, string> = {
  name: "getColdEmailGuide",
  description: "Returns the cold email writing guide text for email drafting.",
  inputSchema: emptyInput,
  outputSchema: guideOutput,
  cacheable: true,
  estimatedLatencyMs: 0,
  async execute(): Promise<string> {
    return getColdEmailGuidePlain();
  },
};
