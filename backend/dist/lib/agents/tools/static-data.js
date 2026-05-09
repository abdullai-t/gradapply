// @ts-nocheck
import { z } from "zod";
import { COUNTRY_OPTIONS } from "@/lib/country-options";
import { DEGREE_OPTIONS, PROGRAM_OPTIONS } from "@/lib/grad-options";
import { getColdEmailGuidePlain } from "@/lib/cold-email-guide";
const emptyInput = z.object({});
// ---------------------------------------------------------------------------
// getCountryOptions
// ---------------------------------------------------------------------------
const countryOutput = z.array(z.string());
export const getCountryOptionsTool = {
    name: "getCountryOptions",
    description: "Returns the curated list of country options for school forms.",
    inputSchema: emptyInput,
    outputSchema: countryOutput,
    cacheable: true,
    estimatedLatencyMs: 0,
    async execute() {
        return [...COUNTRY_OPTIONS];
    },
};
// ---------------------------------------------------------------------------
// getProgramOptions
// ---------------------------------------------------------------------------
const programOutput = z.array(z.string());
export const getProgramOptionsTool = {
    name: "getProgramOptions",
    description: "Returns the curated list of graduate program options.",
    inputSchema: emptyInput,
    outputSchema: programOutput,
    cacheable: true,
    estimatedLatencyMs: 0,
    async execute() {
        return [...PROGRAM_OPTIONS];
    },
};
// ---------------------------------------------------------------------------
// getDegreeOptions
// ---------------------------------------------------------------------------
const degreeOutput = z.array(z.string());
export const getDegreeOptionsTool = {
    name: "getDegreeOptions",
    description: "Returns the curated list of graduate degree options.",
    inputSchema: emptyInput,
    outputSchema: degreeOutput,
    cacheable: true,
    estimatedLatencyMs: 0,
    async execute() {
        return [...DEGREE_OPTIONS];
    },
};
// ---------------------------------------------------------------------------
// getColdEmailGuide
// ---------------------------------------------------------------------------
const guideOutput = z.string();
export const getColdEmailGuideTool = {
    name: "getColdEmailGuide",
    description: "Returns the cold email writing guide text for email drafting.",
    inputSchema: emptyInput,
    outputSchema: guideOutput,
    cacheable: true,
    estimatedLatencyMs: 0,
    async execute() {
        return getColdEmailGuidePlain();
    },
};
