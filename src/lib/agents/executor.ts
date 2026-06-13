/**
 * Agent executor — runs an agent definition through its model chain,
 * executing tool calls on demand and handling auto-handoffs.
 *
 * Flow:
 * 1. Build system prompt (may use tools to load context)
 * 2. Call LLM with the agent's model chain (fallback on provider errors)
 * 3. Return AgentResult or HandoffResult
 */

import type {
  AgentContext,
  AgentDefinition,
  AgentOutput,
  AgentResult,
  HandoffResult,
  StreamEvent,
} from "./types";
import type { LlmProvider } from "@/lib/llm-provider";
import type { ChatTurn } from "@/lib/llm-execute-chat";
import { executeChatTurn, executeChatTurnStream } from "@/lib/llm-execute-chat";
import {
  classifyLlmErrorClass,
  shouldFallbackToAlternateProvider,
} from "@/lib/llm-credits";
import { scheduleLlmOutputQuality } from "@/lib/llm/qualityGate";
import { log } from "@/lib/logger";
import { emitTrace } from "./trace";
import { getToolsForAgent } from "./tools";
import { getAgent } from "./definitions";

const MAX_HANDOFF_DEPTH = 3;

// ---------------------------------------------------------------------------
// Tool description block injected into system prompts
// ---------------------------------------------------------------------------

function toolDescriptionBlock(toolNames: string[]): string {
  const tools = getToolsForAgent(toolNames);
  if (tools.length === 0) return "";

  const lines = tools.map(
    (t) => `- ${t.name}: ${t.description}`,
  );
  return [
    "",
    "Available tools (for your context — data has been pre-loaded where relevant):",
    ...lines,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Execute a single agent
// ---------------------------------------------------------------------------

export async function executeAgent(
  agent: AgentDefinition,
  ctx: AgentContext,
  message: string,
  history: ChatTurn[] = [],
  payload: Record<string, unknown> = {},
): Promise<AgentOutput> {
  const start = Date.now();

  emitTrace(ctx, agent.id, "agent_start", {
    tools: agent.tools,
    tier: agent.modelConfig.tier,
    handoffDepth: ctx.handoffDepth,
  });

  // 1. Pre-load tool data that the system prompt might reference
  const toolData = await preloadTools(agent, ctx, payload);

  // 2. Build the full system prompt
  let systemPrompt = await agent.buildSystemPrompt(ctx, { ...payload, ...toolData });

  // Append tool descriptions so the model knows what data sources are available
  systemPrompt += toolDescriptionBlock(agent.tools);

  // Append pre-loaded tool data as context
  const contextBlock = formatToolContext(toolData);
  if (contextBlock) {
    systemPrompt += "\n\n" + contextBlock;
  }

  // 3. Build conversation turns
  const turns: ChatTurn[] = [
    ...history,
    { role: "user", content: message },
  ];

  // 4. Execute LLM call through the model chain
  const { text, provider, model } = await executeWithChain(
    agent,
    ctx,
    systemPrompt,
    turns,
  );

  emitTrace(ctx, agent.id, "agent_end", {
    provider,
    model,
    responseLength: text.length,
    durationMs: Date.now() - start,
  });

  // 5. Check for auto-handoff
  if (agent.autoHandoff && ctx.handoffDepth < MAX_HANDOFF_DEPTH) {
    const targetAgent = getAgent(agent.autoHandoff);
    if (targetAgent) {
      const handoff: HandoffResult = {
        type: "handoff",
        targetAgent: agent.autoHandoff,
        reason: `Auto-handoff from ${agent.id} after completion`,
        payload: { ...payload, previousResult: text },
        intermediateResult: text,
      };

      emitTrace(ctx, agent.id, "handoff", {
        target: agent.autoHandoff,
        reason: handoff.reason,
      });

      return handoff;
    }
  }

  // 6. Return the final result
  const result: AgentResult = {
    type: "result",
    text,
    agentId: agent.id,
    modelUsed: { provider, model: model ?? "" },
  };

  return result;
}

// ---------------------------------------------------------------------------
// Execute a handoff chain (recursive with depth limit)
// ---------------------------------------------------------------------------

export async function executeAgentChain(
  agent: AgentDefinition,
  ctx: AgentContext,
  message: string,
  history: ChatTurn[] = [],
  payload: Record<string, unknown> = {},
): Promise<AgentResult> {
  let currentAgent = agent;
  let currentMessage = message;
  let currentPayload = payload;

  for (let depth = 0; depth <= MAX_HANDOFF_DEPTH; depth++) {
    ctx.handoffDepth = depth;

    const output = await executeAgent(
      currentAgent,
      ctx,
      currentMessage,
      history,
      currentPayload,
    );

    if (output.type === "result") {
      return output;
    }

    // Handoff — resolve the next agent
    const nextAgent = getAgent(output.targetAgent);
    if (!nextAgent) {
      // Target agent not found — return the intermediate result
      return {
        type: "result",
        text: output.intermediateResult ?? "An error occurred during handoff.",
        agentId: currentAgent.id,
        modelUsed: { provider: "openrouter", model: "" },
      };
    }

    currentAgent = nextAgent;
    currentPayload = output.payload;
    // If there's an intermediate result, pass it as context
    if (output.intermediateResult) {
      currentMessage = output.intermediateResult;
    }
  }

  // Should not reach here, but safety net
  return {
    type: "result",
    text: "Maximum handoff depth reached.",
    agentId: agent.id,
    modelUsed: { provider: "openrouter", model: "" },
  };
}

// ---------------------------------------------------------------------------
// LLM execution with provider chain fallback
// ---------------------------------------------------------------------------

async function executeWithChain(
  agent: AgentDefinition,
  ctx: AgentContext,
  systemPrompt: string,
  turns: ChatTurn[],
): Promise<{ text: string; provider: LlmProvider; model?: string }> {
  const { chain, maxTokens } = agent.modelConfig;
  let lastErr: unknown;

  for (const { provider, model } of chain) {
    const start = Date.now();
    emitTrace(ctx, agent.id, "llm_call", { provider, model, maxTokens });

    try {
      const text = await executeChatTurn({
        provider,
        model,
        system: systemPrompt,
        turns,
        maxTokens,
      });

      emitTrace(ctx, agent.id, "llm_result", {
        provider,
        model,
        responseLength: text.length,
        durationMs: Date.now() - start,
      });

      scheduleLlmOutputQuality({
        userId: ctx.userId,
        feature: agent.id,
        model: model ?? provider,
        output: text,
      });

      return { text, provider, model };
    } catch (error) {
      lastErr = error;
      const errorClass = classifyLlmErrorClass(error);

      emitTrace(ctx, agent.id, "error", {
        provider,
        model,
        error: error instanceof Error ? error.message : String(error),
        errorClass,
        durationMs: Date.now() - start,
      });

      log.warn("llm.chain.failed", {
        agent: agent.id,
        provider,
        model: model ?? null,
        errorClass,
        reason: error instanceof Error ? error.message : String(error),
        willFallback: shouldFallbackToAlternateProvider(error),
      });

      if (!shouldFallbackToAlternateProvider(error)) {
        throw error;
      }
      // Try next provider in chain
      continue;
    }
  }

  throw lastErr instanceof Error
    ? lastErr
    : new Error(`All providers failed for agent "${agent.id}"`);
}

// ---------------------------------------------------------------------------
// Streaming: LLM execution with provider chain fallback
// ---------------------------------------------------------------------------

async function* executeWithChainStream(
  agent: AgentDefinition,
  ctx: AgentContext,
  systemPrompt: string,
  turns: ChatTurn[],
): AsyncGenerator<string, { text: string; provider: LlmProvider; model?: string }, unknown> {
  const { chain, maxTokens } = agent.modelConfig;
  let lastErr: unknown;

  for (const { provider, model } of chain) {
    const start = Date.now();
    emitTrace(ctx, agent.id, "llm_call", { provider, model, maxTokens, streaming: true });

    let hasYielded = false;
    try {
      const gen = executeChatTurnStream({
        provider,
        model,
        system: systemPrompt,
        turns,
        maxTokens,
      });

      let result = await gen.next();
      while (!result.done) {
        hasYielded = true;
        yield result.value;
        result = await gen.next();
      }

      const text = result.value;
      scheduleLlmOutputQuality({
        userId: ctx.userId,
        feature: agent.id,
        model: model ?? provider,
        output: text,
      });

      emitTrace(ctx, agent.id, "llm_result", {
        provider,
        model,
        responseLength: text.length,
        durationMs: Date.now() - start,
        streaming: true,
      });

      return { text, provider, model };
    } catch (error) {
      lastErr = error;
      const errorClass = classifyLlmErrorClass(error);

      emitTrace(ctx, agent.id, "error", {
        provider,
        model,
        error: error instanceof Error ? error.message : String(error),
        errorClass,
        durationMs: Date.now() - start,
        streaming: true,
      });

      // If tokens were already yielded, we can't silently switch providers
      if (hasYielded) throw error;

      if (!shouldFallbackToAlternateProvider(error)) throw error;
      continue;
    }
  }

  throw lastErr instanceof Error
    ? lastErr
    : new Error(`All providers failed for agent "${agent.id}" (streaming)`);
}

// ---------------------------------------------------------------------------
// Streaming: execute a single agent, yielding StreamEvents
// ---------------------------------------------------------------------------

export async function* executeAgentStream(
  agent: AgentDefinition,
  ctx: AgentContext,
  message: string,
  history: ChatTurn[] = [],
  payload: Record<string, unknown> = {},
): AsyncGenerator<StreamEvent, { text: string; provider: LlmProvider; model?: string }, unknown> {
  const start = Date.now();

  emitTrace(ctx, agent.id, "agent_start", {
    tools: agent.tools,
    tier: agent.modelConfig.tier,
    handoffDepth: ctx.handoffDepth,
    streaming: true,
  });

  // 1. Pre-load tool data
  const toolData = await preloadTools(agent, ctx, payload);

  // 2. Build system prompt
  let systemPrompt = await agent.buildSystemPrompt(ctx, { ...payload, ...toolData });
  systemPrompt += toolDescriptionBlock(agent.tools);
  const contextBlock = formatToolContext(toolData);
  if (contextBlock) {
    systemPrompt += "\n\n" + contextBlock;
  }

  // 3. Build conversation turns
  const turns: ChatTurn[] = [...history, { role: "user", content: message }];

  // 4. Yield agent identifier
  yield { type: "agent", agentId: agent.id };

  // 5. Stream LLM response
  const gen = executeWithChainStream(agent, ctx, systemPrompt, turns);
  let result = await gen.next();
  while (!result.done) {
    yield { type: "token", content: result.value };
    result = await gen.next();
  }

  const { text, provider, model } = result.value;

  emitTrace(ctx, agent.id, "agent_end", {
    provider,
    model,
    responseLength: text.length,
    durationMs: Date.now() - start,
    streaming: true,
  });

  // 6. Check for auto-handoff
  if (agent.autoHandoff && ctx.handoffDepth < MAX_HANDOFF_DEPTH) {
    const targetAgent = getAgent(agent.autoHandoff);
    if (targetAgent) {
      emitTrace(ctx, agent.id, "handoff", {
        target: agent.autoHandoff,
        reason: `Auto-handoff from ${agent.id} after streaming completion`,
      });

      // Stream the next agent
      ctx.handoffDepth++;
      const nextGen = executeAgentStream(
        targetAgent,
        ctx,
        text,
        history,
        { ...payload, previousResult: text },
      );

      let nextResult = await nextGen.next();
      while (!nextResult.done) {
        yield nextResult.value;
        nextResult = await nextGen.next();
      }

      return nextResult.value;
    }
  }

  yield { type: "done", agentId: agent.id };
  return { text, provider, model };
}

// ---------------------------------------------------------------------------
// Tool pre-loading — fetch data that agents commonly need
// ---------------------------------------------------------------------------

async function preloadTools(
  agent: AgentDefinition,
  ctx: AgentContext,
  payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const data: Record<string, unknown> = {};
  const tools = getToolsForAgent(agent.tools);
  const inferOnly = payload.inferOnly === true;

  // Parallel-load all zero-input or payload-driven tools
  const loads: Promise<void>[] = [];

  for (const tool of tools) {
    if (
      inferOnly &&
      (tool.name === "getProfile" || tool.name === "getExistingSchools")
    ) {
      continue;
    }
    // Auto-load profile if the agent has access to it
    if (tool.name === "getProfile") {
      loads.push(
        tool.execute({}, ctx).then((result) => {
          data.profile = result;
        }).catch(() => { /* profile not critical */ }),
      );
    }

    // Auto-load school if schoolId is in payload
    if (tool.name === "getSchool" && typeof payload.schoolId === "string") {
      loads.push(
        tool.execute({ schoolId: payload.schoolId }, ctx).then((result) => {
          data.school = result;
        }).catch(() => { /* school not critical */ }),
      );
    }

    // Auto-load existing schools list
    if (tool.name === "getExistingSchools") {
      loads.push(
        tool.execute({}, ctx).then((result) => {
          data.existingSchools = result;
        }).catch(() => {}),
      );
    }

    // Auto-load SOP variant if schoolId is in payload
    if (tool.name === "getSopVariant" && typeof payload.schoolId === "string") {
      loads.push(
        tool.execute({ schoolId: payload.schoolId }, ctx).then((result) => {
          data.sopVariant = result;
        }).catch(() => {}),
      );
    }

    // Auto-load master SOP
    if (tool.name === "getMasterSop") {
      const schoolId = typeof payload.schoolId === "string" ? payload.schoolId : undefined;
      loads.push(
        tool.execute({ schoolId }, ctx).then((result) => {
          data.masterSop = result;
        }).catch(() => {}),
      );
    }

    // Auto-load prof email if profEmailId is in payload
    if (tool.name === "getProfEmail" && typeof payload.profEmailId === "string") {
      loads.push(
        tool.execute({ profEmailId: payload.profEmailId }, ctx).then((result) => {
          data.profEmail = result;
        }).catch(() => {}),
      );
    }

    // Auto-load cold email guide
    if (tool.name === "getColdEmailGuide") {
      loads.push(
        tool.execute({}, ctx).then((result) => {
          data.coldEmailGuide = result;
        }).catch(() => {}),
      );
    }

    // Auto-load static options
    if (tool.name === "getCountryOptions") {
      loads.push(
        tool.execute({}, ctx).then((result) => {
          data.countryOptions = result;
        }).catch(() => {}),
      );
    }
    if (tool.name === "getProgramOptions") {
      loads.push(
        tool.execute({}, ctx).then((result) => {
          data.programOptions = result;
        }).catch(() => {}),
      );
    }
    if (tool.name === "getDegreeOptions") {
      loads.push(
        tool.execute({}, ctx).then((result) => {
          data.degreeOptions = result;
        }).catch(() => {}),
      );
    }

    // Fetch faculty page if URL is in payload
    if (tool.name === "fetchFacultyPage" && typeof payload.url === "string") {
      loads.push(
        tool.execute({ url: payload.url }, ctx).then((result) => {
          data.facultyPage = result;
        }).catch(() => {}),
      );
    }

    // Extract page links if URL is in payload
    if (tool.name === "extractPageLinks" && typeof payload.url === "string") {
      loads.push(
        tool.execute({ url: payload.url }, ctx).then((result) => {
          data.pageLinks = result;
        }).catch(() => {}),
      );
    }

    // Load document text if documentId is in payload
    if (tool.name === "getDocumentText" && typeof payload.documentId === "string") {
      loads.push(
        tool.execute({ documentId: payload.documentId }, ctx).then((result) => {
          data.documentText = result;
        }).catch(() => {}),
      );
    }

    // Load document summary
    if (tool.name === "getDocumentSummary") {
      loads.push(
        tool.execute({}, ctx).then((result) => {
          data.documentSummary = result;
        }).catch(() => {}),
      );
    }
  }

  await Promise.all(loads);
  return data;
}

// ---------------------------------------------------------------------------
// Format pre-loaded tool data as context for the system prompt
// ---------------------------------------------------------------------------

function formatToolContext(data: Record<string, unknown>): string {
  const sections: string[] = [];

  if (data.profile) {
    const p = data.profile as Record<string, unknown>;
    const lines = [
      "## Applicant Profile",
      p.fullName && `Name: ${p.fullName}`,
      p.targetDegree && `Target degree: ${p.targetDegree}`,
      p.focusArea && `Focus area: ${p.focusArea}`,
      p.researchInterests && `Research interests: ${p.researchInterests}`,
      p.undergradDegree && `Undergrad: ${p.undergradDegree}${p.undergradSchool ? ` from ${p.undergradSchool}` : ""}`,
      p.yearsExperience && `Experience: ${p.yearsExperience}`,
      p.greVerbal != null && `GRE: ${p.greVerbal ?? "—"}V / ${p.greQuant ?? "—"}Q / ${p.greAWA ?? "—"}AWA`,
    ].filter(Boolean);
    sections.push(`<user_data field="applicant profile">\n${lines.join("\n")}\n</user_data>`);
  }

  if (data.school) {
    const s = data.school as Record<string, unknown>;
    const lines = [
      "## Target School",
      s.name && `Name: ${s.name}`,
      s.program && `Program: ${s.program}`,
      s.degree && `Degree: ${s.degree}`,
      s.country && `Country: ${s.country}`,
      s.deadline && `Deadline: ${s.deadline}`,
    ].filter(Boolean);
    sections.push(`<user_data field="target school">\n${lines.join("\n")}\n</user_data>`);
  }

  if (data.existingSchools && Array.isArray(data.existingSchools) && data.existingSchools.length > 0) {
    const schools = data.existingSchools as { name: string; program?: string }[];
    const listBody = "## Applicant's School List\n" +
      schools.map((s) => `- ${s.name}${s.program ? ` (${s.program})` : ""}`).join("\n");
    sections.push(`<user_data field="school list">\n${listBody}\n</user_data>`);
  }

  if (data.sopVariant) {
    const v = data.sopVariant as Record<string, unknown>;
    sections.push(
      `<user_data field="SOP variant">\n## Existing SOP Variant\nTitle: ${v.title}\n\n${v.body}\n</user_data>`,
    );
  }

  if (data.masterSop) {
    const m = data.masterSop as Record<string, unknown>;
    sections.push(
      `<user_data field="master SOP">\n## Master SOP\nSource: ${m.source}\n\n${m.text}\n</user_data>`,
    );
  }

  if (data.profEmail) {
    const e = data.profEmail as Record<string, unknown>;
    const lines = [
      "## Professor Email Record",
      e.profName && `Professor: ${e.profName}`,
      e.university && `University: ${e.university}`,
      e.researchArea && `Research area: ${e.researchArea}`,
      e.status && `Status: ${e.status}`,
      e.emailSubject && `Subject: ${e.emailSubject}`,
      e.lastReplySnippet && `Last reply: ${e.lastReplySnippet}`,
      e.replyIntent && `Reply intent: ${e.replyIntent}`,
    ].filter(Boolean);
    sections.push(`<user_data field="professor email">\n${lines.join("\n")}\n</user_data>`);
  }

  if (data.facultyPage) {
    const fp = data.facultyPage as Record<string, unknown>;
    const text = typeof fp.text === "string" ? fp.text : "";
    if (text) {
      const truncated = text.length > 8000 ? text.slice(0, 8000) + "…" : text;
      sections.push(`<user_data field="faculty page">\n## Faculty Page Content\nURL: ${fp.url}\n\n${truncated}\n</user_data>`);
    }
  }

  if (data.coldEmailGuide && typeof data.coldEmailGuide === "string") {
    const guide = data.coldEmailGuide.length > 4000
      ? data.coldEmailGuide.slice(0, 4000) + "…"
      : data.coldEmailGuide;
    sections.push(`## Cold Email Guide\n${guide}`);
  }

  if (data.programOptions && Array.isArray(data.programOptions)) {
    sections.push(`## Program Options\n${(data.programOptions as string[]).join(", ")}`);
  }

  if (data.degreeOptions && Array.isArray(data.degreeOptions)) {
    sections.push(`## Degree Options\n${(data.degreeOptions as string[]).join(", ")}`);
  }

  return sections.join("\n\n---\n\n");
}
