// @ts-nocheck
/**
 * Agent system — barrel exports.
 *
 * Usage:
 *   import { runOrchestrator, runTask } from "@/lib/agents";
 */

// Core types
export type {
  ModelTier,
  ModelConfig,
  AgentContext,
  AgentDefinition,
  AgentResult,
  HandoffResult,
  AgentOutput,
  TraceEvent,
  OrchestratorInput,
  OrchestratorResult,
  StreamEvent,
  OrchestratorStreamResult,
} from "./types";

// Orchestrator (main entry points)
export {
  runOrchestrator,
  runOrchestratorStream,
  runTask,
} from "./orchestrator";

// Agent registry
export { getAgent, getAllAgents, getAgentIds, validateAgentToolBindings } from "./registry";

// Context factory
export { buildAgentContext } from "./context";

// Sanitization utilities
export { sanitizeField, wrapUserContent } from "./sanitize";
