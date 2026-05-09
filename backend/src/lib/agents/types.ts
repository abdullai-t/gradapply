// @ts-nocheck
import type { z } from "zod";

import type { LlmProvider } from "@/lib/llm-provider";

// ---------------------------------------------------------------------------
// Model tiers
// ---------------------------------------------------------------------------

export type ModelTier = "t1-router" | "t2-balanced" | "t3-premium";

export type ModelConfig = {
  tier: ModelTier;
  /** Ordered provider→model pairs. First available wins; last is always Anthropic safety-net. */
  chain: { provider: LlmProvider; model: string }[];
  maxTokens: number;
};

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

export interface ToolDefinition<
  TInput = unknown,
  TOutput = unknown,
> {
  name: string;
  description: string;
  inputSchema: z.ZodType<TInput>;
  outputSchema: z.ZodType<TOutput>;
  execute: (input: TInput, ctx: AgentContext) => Promise<TOutput>;
  cacheable: boolean;
  estimatedLatencyMs: number;
}

// ---------------------------------------------------------------------------
// Agent context (per-request)
// ---------------------------------------------------------------------------

export type AgentContext = {
  userId: string;
  traceId: string;
  /** Per-request tool result cache keyed by `toolName:JSON(input)` */
  toolCache: Map<string, unknown>;
  /** Accumulated trace events for observability */
  trace: TraceEvent[];
  /** Current handoff depth (max 3) */
  handoffDepth: number;
};

// ---------------------------------------------------------------------------
// Agent definition
// ---------------------------------------------------------------------------

export type AgentDefinition = {
  id: string;
  label: string;
  description: string;
  modelConfig: ModelConfig;
  tools: string[];
  /** System prompt builder (may use tool results to load context on-demand) */
  buildSystemPrompt: (
    ctx: AgentContext,
    payload: Record<string, unknown>,
  ) => Promise<string> | string;
  /** Optional handoff target after completion */
  autoHandoff?: string;
};

// ---------------------------------------------------------------------------
// Agent output
// ---------------------------------------------------------------------------

export type AgentResult = {
  type: "result";
  text: string;
  /** Structured data (JSON-parsed) when the agent returns structured output */
  data?: unknown;
  agentId: string;
  modelUsed: { provider: LlmProvider; model: string };
};

export type HandoffResult = {
  type: "handoff";
  targetAgent: string;
  reason: string;
  payload: Record<string, unknown>;
  /** Partial result visible to user while the next agent works */
  intermediateResult?: string;
};

export type AgentOutput = AgentResult | HandoffResult;

// ---------------------------------------------------------------------------
// Trace events
// ---------------------------------------------------------------------------

export type TraceEvent = {
  timestamp: number;
  agentId: string;
  event:
    | "agent_start"
    | "agent_end"
    | "tool_call"
    | "tool_result"
    | "llm_call"
    | "llm_result"
    | "handoff"
    | "error";
  data: Record<string, unknown>;
  durationMs?: number;
};

// ---------------------------------------------------------------------------
// Orchestrator types
// ---------------------------------------------------------------------------

export type OrchestratorInput = {
  mode: string;
  message: string;
  history?: { role: "user" | "assistant"; content: string }[];
  /** Extra payload forwarded to the resolved agent */
  payload?: Record<string, unknown>;
};

export type OrchestratorResult = {
  reply: string;
  agentId: string;
  traceId: string;
  modelUsed: { provider: LlmProvider; model: string };
  /** Structured data from the agent, if any */
  data?: unknown;
  trace: TraceEvent[];
};

// ---------------------------------------------------------------------------
// Streaming types
// ---------------------------------------------------------------------------

export type StreamEvent =
  | { type: "token"; content: string }
  | { type: "agent"; agentId: string }
  | { type: "done"; agentId: string }
  | { type: "error"; message: string };

export interface OrchestratorStreamResult {
  stream: AsyncGenerator<StreamEvent, void, unknown>;
  finalResult: Promise<OrchestratorResult>;
}
