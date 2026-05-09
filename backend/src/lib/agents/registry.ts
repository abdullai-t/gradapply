// @ts-nocheck
/**
 * Agent registry — central lookup for agent definitions.
 *
 * Re-exports from definitions for convenience, plus helper to validate
 * tool availability for an agent at startup.
 */

export { getAgent, getAllAgents, getAgentIds } from "./definitions";

import { getAllAgents } from "./definitions";
import { getTool } from "./tools";

/**
 * Validates that every tool referenced by agent definitions actually exists
 * in the tool registry. Call at app startup for early failure detection.
 */
export function validateAgentToolBindings(): string[] {
  const errors: string[] = [];

  for (const agent of getAllAgents()) {
    for (const toolName of agent.tools) {
      if (!getTool(toolName)) {
        errors.push(`Agent "${agent.id}" references unknown tool "${toolName}"`);
      }
    }
  }

  return errors;
}
