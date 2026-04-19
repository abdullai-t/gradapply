import type { ChatMode } from "@/lib/ai";
import type { LlmProvider } from "@/lib/llm-provider";
import { getLlmProvider } from "@/lib/llm-provider";
import { openAiGrammarModel, openAiDefaultModel } from "@/lib/openai-direct";
import { openRouterModel } from "@/lib/openrouter";

export type AgentRouting = {
  /** Tab the user chose in the UI */
  tabMode: ChatMode;
  /** Task actually handled after routing (may differ when tab is General) */
  effectiveMode: ChatMode;
  agentId: string;
  agentLabel: string;
  provider: LlmProvider;
  /** Pass-through model id for the execution layer */
  model?: string;
  routedFromGeneral: boolean;
  /** Served via another backend after insufficient credits on the preferred provider */
  creditFallback?: boolean;
};

const LABEL: Record<ChatMode, string> = {
  general: "Navigator",
  grammar: "Grammar & clarity",
  sop: "SOP coach",
  email: "Outreach specialist",
  feedback: "Strategy & critique",
};

/**
 * Lightweight intent hints when the user stays on General — no extra LLM call.
 */
export function inferTaskFromGeneralMessage(text: string): ChatMode | null {
  const t = text.toLowerCase();
  if (
    /\b(statement of purpose|\bsop\b|personal statement|ps\b|motivation letter)\b/.test(
      t,
    )
  )
    return "sop";
  if (
    /\b(professor|cold email|outreach|reply to pi|contact.*lab)\b/.test(t)
  )
    return "email";
  if (
    /\b(grammar|proofread|typo|spell|comma|sentence structure|copy-?edit)\b/.test(
      t,
    )
  )
    return "grammar";
  if (
    /\b(feedback|critique|tear apart|honest|review my|what.?s wrong)\b/.test(t)
  )
    return "feedback";
  return null;
}

function grammarExecution(): { provider: LlmProvider; model?: string } {
  if (process.env.OPENAI_API_KEY?.trim()) {
    return { provider: "openai", model: openAiGrammarModel() };
  }

  const p = getLlmProvider();
  if (p === "openrouter") {
    const override = process.env.OPENROUTER_MODEL_GRAMMAR?.trim();
    return { provider: "openrouter", model: override || openRouterModel() };
  }
  return { provider: p };
}

function qualityExecution(): { provider: LlmProvider; model?: string } {
  const p = getLlmProvider();
  if (p === "openai") {
    return { provider: "openai", model: openAiDefaultModel() };
  }
  if (p === "openrouter") {
    return { provider: "openrouter", model: openRouterModel() };
  }
  return { provider: "anthropic" };
}

export function routeAssistantAgent(
  tabMode: ChatMode,
  message: string,
): Omit<AgentRouting, "tabMode"> & { tabMode: ChatMode } {
  let effectiveMode = tabMode;
  let routedFromGeneral = false;

  if (tabMode === "general") {
    const inferred = inferTaskFromGeneralMessage(message);
    if (inferred) {
      effectiveMode = inferred;
      routedFromGeneral = true;
    }
  }

  const agentId = `gradapply.${effectiveMode}`;

  let provider: LlmProvider;
  let model: string | undefined;

  if (effectiveMode === "grammar") {
    const ex = grammarExecution();
    provider = ex.provider;
    model = ex.model;
  } else {
    const ex = qualityExecution();
    provider = ex.provider;
    model = ex.model;
  }

  return {
    tabMode,
    effectiveMode,
    agentId,
    agentLabel: LABEL[effectiveMode],
    provider,
    model,
    routedFromGeneral,
  };
}

/** Extra line added to system prompt so the model stays in persona. */
export function agentHintLine(routing: AgentRouting): string {
  if (routing.routedFromGeneral) {
    return `You are GradApply's "${routing.agentLabel}" agent (task auto-selected from the user's message while they were on General). Stay in this role for this reply.`;
  }
  return `You are GradApply's "${routing.agentLabel}" agent for this conversation tab.`;
}
