// @ts-nocheck
import type { ToolDefinition } from "../types";

import { getProfileTool } from "./get-profile";
import { getSchoolTool, getSchoolByNameTool, getExistingSchoolsTool } from "./get-school";
import { getDocumentTextTool, getDocumentSummaryTool } from "./get-documents";
import { getSopVariantTool, getMasterSopTool } from "./get-sop";
import { getProfEmailTool } from "./get-prof-email";
import { fetchFacultyPageTool, extractPageLinksTool } from "./fetch-faculty-page";
import {
  getCountryOptionsTool,
  getProgramOptionsTool,
  getDegreeOptionsTool,
  getColdEmailGuideTool,
} from "./static-data";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ALL_TOOLS: ToolDefinition<any, any>[] = [
  getProfileTool,
  getSchoolTool,
  getSchoolByNameTool,
  getExistingSchoolsTool,
  getDocumentTextTool,
  getDocumentSummaryTool,
  getSopVariantTool,
  getMasterSopTool,
  getProfEmailTool,
  fetchFacultyPageTool,
  extractPageLinksTool,
  getCountryOptionsTool,
  getProgramOptionsTool,
  getDegreeOptionsTool,
  getColdEmailGuideTool,
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const registry = new Map<string, ToolDefinition<any, any>>();
for (const tool of ALL_TOOLS) {
  registry.set(tool.name, tool);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getTool(name: string): ToolDefinition<any, any> | undefined {
  return registry.get(name);
}

export function getToolsForAgent(toolNames: string[]): ToolDefinition[] {
  return toolNames
    .map((name) => registry.get(name))
    .filter((t): t is ToolDefinition => t !== undefined);
}

export function allToolNames(): string[] {
  return Array.from(registry.keys());
}
