/**
 * Orchestrator — the main entry point for the agent system.
 *
 * Usage:
 *   const result = await runOrchestrator({ mode, message, history, payload }, userId);
 *
 * Flow:
 * 1. Build AgentContext for this request
 * 2. Resolve the target agent via router (direct mapping, regex, or LLM)
 * 3. Execute the agent (with auto-handoff chain if applicable)
 * 4. Return OrchestratorResult
 */

import { buildAgentContext } from "./context";
import { getAgent } from "./definitions";
import { executeAgentChain, executeAgentStream } from "./executor";
import { resolveAgent } from "./router-prompt";
import { emitTrace } from "./trace";
import type {
  OrchestratorInput,
  OrchestratorResult,
  OrchestratorStreamResult,
  StreamEvent,
} from "./types";

/**
 * Run the full orchestrator pipeline.
 */
export async function runOrchestrator(
  input: OrchestratorInput,
  userId: string,
): Promise<OrchestratorResult> {
  const ctx = buildAgentContext(userId);
  const startTime = Date.now();

  emitTrace(ctx, "orchestrator", "agent_start", {
    mode: input.mode,
    messageLength: input.message.length,
    historyLength: input.history?.length ?? 0,
  });

  // 1. Resolve the target agent
  const { agentId, routedFromGeneral } = await resolveAgent(
    input.mode,
    input.message,
    ctx,
  );

  emitTrace(ctx, "orchestrator", "tool_result", {
    resolvedAgent: agentId,
    routedFromGeneral,
  });

  // 2. Look up the agent definition
  const agent = getAgent(agentId);
  if (!agent) {
    emitTrace(ctx, "orchestrator", "error", {
      error: `Agent "${agentId}" not found in registry`,
    });
    return {
      reply: "I'm sorry, I couldn't process your request. Please try again.",
      agentId: "orchestrator",
      traceId: ctx.traceId,
      modelUsed: { provider: "anthropic", model: "" },
      trace: ctx.trace,
    };
  }

  // 3. Execute the agent (handles handoff chain internally)
  const result = await executeAgentChain(
    agent,
    ctx,
    input.message,
    input.history ?? [],
    input.payload ?? {},
  );

  emitTrace(ctx, "orchestrator", "agent_end", {
    finalAgent: result.agentId,
    totalDurationMs: Date.now() - startTime,
  });

  // 4. Assemble result
  return {
    reply: result.text,
    agentId: result.agentId,
    traceId: ctx.traceId,
    modelUsed: result.modelUsed,
    data: result.data,
    trace: ctx.trace,
  };
}

/**
 * Run a specific agent directly (for one-shot tasks like school inference, SOP scoring).
 * Bypasses the router and runs the named agent with the given payload.
 */
export async function runTask(
  agentId: string,
  message: string,
  userId: string,
  payload: Record<string, unknown> = {},
): Promise<OrchestratorResult> {
  const ctx = buildAgentContext(userId);
  const startTime = Date.now();

  emitTrace(ctx, "orchestrator", "agent_start", {
    directTask: agentId,
    messageLength: message.length,
  });

  const agent = getAgent(agentId);
  if (!agent) {
    throw new Error(`Agent "${agentId}" not found in registry`);
  }

  const result = await executeAgentChain(agent, ctx, message, [], payload);

  emitTrace(ctx, "orchestrator", "agent_end", {
    finalAgent: result.agentId,
    totalDurationMs: Date.now() - startTime,
  });

  return {
    reply: result.text,
    agentId: result.agentId,
    traceId: ctx.traceId,
    modelUsed: result.modelUsed,
    data: result.data,
    trace: ctx.trace,
  };
}

/**
 * Streaming version of runOrchestrator.
 *
 * Intent classification runs synchronously first (fast T1 call), then
 * the resolved agent streams its response.
 *
 * Returns { stream, finalResult } where:
 * - stream: async generator yielding StreamEvents (token, agent, done, error)
 * - finalResult: promise that resolves with the full OrchestratorResult after
 *   the stream completes (used for DB persistence + billing)
 */
export function runOrchestratorStream(
  input: OrchestratorInput,
  userId: string,
): OrchestratorStreamResult {
  const ctx = buildAgentContext(userId);
  const startTime = Date.now();

  let resolveFinal!: (value: OrchestratorResult) => void;
  let rejectFinal!: (reason: unknown) => void;
  const finalResult = new Promise<OrchestratorResult>((resolve, reject) => {
    resolveFinal = resolve;
    rejectFinal = reject;
  });

  async function* generate(): AsyncGenerator<StreamEvent, void, unknown> {
    try {
      emitTrace(ctx, "orchestrator", "agent_start", {
        mode: input.mode,
        messageLength: input.message.length,
        historyLength: input.history?.length ?? 0,
        streaming: true,
      });

      // 1. Resolve the target agent (non-streaming, fast T1)
      const { agentId, routedFromGeneral } = await resolveAgent(
        input.mode,
        input.message,
        ctx,
      );

      emitTrace(ctx, "orchestrator", "tool_result", {
        resolvedAgent: agentId,
        routedFromGeneral,
      });

      // 2. Look up the agent definition
      const agent = getAgent(agentId);
      if (!agent) {
        emitTrace(ctx, "orchestrator", "error", {
          error: `Agent "${agentId}" not found in registry`,
        });
        const errorResult: OrchestratorResult = {
          reply: "I'm sorry, I couldn't process your request. Please try again.",
          agentId: "orchestrator",
          traceId: ctx.traceId,
          modelUsed: { provider: "anthropic", model: "" },
          trace: ctx.trace,
        };
        yield { type: "error", message: errorResult.reply };
        resolveFinal(errorResult);
        return;
      }

      // 3. Stream the agent
      const gen = executeAgentStream(
        agent,
        ctx,
        input.message,
        input.history ?? [],
        input.payload ?? {},
      );

      let genResult = await gen.next();
      while (!genResult.done) {
        yield genResult.value;
        genResult = await gen.next();
      }

      const { text, provider, model } = genResult.value;

      emitTrace(ctx, "orchestrator", "agent_end", {
        finalAgent: agentId,
        totalDurationMs: Date.now() - startTime,
        streaming: true,
      });

      resolveFinal({
        reply: text,
        agentId,
        traceId: ctx.traceId,
        modelUsed: { provider, model: model ?? "" },
        trace: ctx.trace,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "An unexpected error occurred";
      yield { type: "error", message };
      rejectFinal(error);
    }
  }

  return { stream: generate(), finalResult };
}
