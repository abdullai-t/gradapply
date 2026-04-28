/**
 * Router classification — resolves the target agent for a given mode + message.
 *
 * Priority:
 * 1. Direct mode mapping (tab != "general" → known agent)
 * 2. Regex fast-path (zero-cost intent detection from `inferTaskFromGeneralMessage`)
 * 3. LLM classification (Tier 1 model, ~$0.00003/call)
 */

import type { AgentContext } from "./types";
import { orchestratorAgent } from "./definitions";
import { executeChatTurn } from "@/lib/llm-execute-chat";
import { emitTrace } from "./trace";
import {
  classifyLlmErrorClass,
  shouldFallbackToAlternateProvider,
} from "@/lib/llm-credits";

// ---------------------------------------------------------------------------
// Regex fast-path intent classifier (zero-cost, no LLM call)
// ---------------------------------------------------------------------------

function inferTaskFromGeneralMessage(text: string): string | null {
  const t = text.toLowerCase();
  if (
    /\b(statement of purpose|\bsop\b|personal statement|ps\b|motivation letter)\b/.test(t)
  )
    return "sop";
  // Cold email drafting is distinct from "find me professors". Match outreach
  // verbs explicitly so faculty-lookup questions don't get pulled into email.
  if (
    /\b(cold email|outreach email|reply to (the )?(pi|professor)|contact .* lab|draft (an? )?email)\b/.test(t)
  )
    return "email";
  if (
    /\b(grammar|proofread|typo|spell|comma|sentence structure|copy-?edit)\b/.test(t)
  )
    return "grammar";
  if (
    /\b(feedback|critique|tear apart|honest|review my|what.?s wrong)\b/.test(t)
  )
    return "feedback";
  return null;
}

// ---------------------------------------------------------------------------
// Direct tab → agent mapping
// ---------------------------------------------------------------------------

const MODE_TO_AGENT: Record<string, string> = {
  grammar: "grammar",
  sop: "sop-writer",
  email: "email-drafter",
  feedback: "navigator", // feedback uses navigator with feedback-oriented prompt
};

// ---------------------------------------------------------------------------
// Regex intent → agent mapping
// ---------------------------------------------------------------------------

const REGEX_INTENT_TO_AGENT: Record<string, string> = {
  sop: "sop-writer",
  email: "email-drafter",
  grammar: "grammar",
  feedback: "navigator",
};

// ---------------------------------------------------------------------------
// LLM classification response → agent mapping
// ---------------------------------------------------------------------------

const CLASSIFICATION_TO_AGENT: Record<string, string> = {
  sop: "sop-writer",
  email: "email-drafter",
  grammar: "grammar",
  feedback: "navigator",
  faculty: "faculty-discovery",
  school: "school-intel",
  reply: "reply-analyzer",
  general: "navigator",
};

// ---------------------------------------------------------------------------
// Main resolver
// ---------------------------------------------------------------------------

export async function resolveAgent(
  mode: string,
  message: string,
  ctx: AgentContext,
): Promise<{ agentId: string; routedFromGeneral: boolean }> {
  // 1. Direct mode mapping
  if (mode !== "general") {
    const agentId = MODE_TO_AGENT[mode] ?? "navigator";
    emitTrace(ctx, "router", "agent_start", {
      strategy: "direct-mode",
      mode,
      agentId,
    });
    return { agentId, routedFromGeneral: false };
  }

  // 2. Regex fast-path (zero cost)
  const regexIntent = inferTaskFromGeneralMessage(message);
  if (regexIntent) {
    const agentId = REGEX_INTENT_TO_AGENT[regexIntent] ?? "navigator";
    emitTrace(ctx, "router", "agent_start", {
      strategy: "regex",
      intent: regexIntent,
      agentId,
    });
    return { agentId, routedFromGeneral: true };
  }

  // 3. LLM classification using Tier 1 model chain
  const systemPrompt = await orchestratorAgent.buildSystemPrompt(ctx, {});
  const { chain, maxTokens } = orchestratorAgent.modelConfig;

  for (const { provider, model } of chain) {
    const start = Date.now();
    try {
      const raw = await executeChatTurn({
        provider,
        model,
        system: systemPrompt,
        turns: [{ role: "user", content: message }],
        maxTokens,
      });

      const category = raw.trim().toLowerCase().replace(/[^a-z]/g, "");
      const agentId = CLASSIFICATION_TO_AGENT[category] ?? "navigator";

      emitTrace(ctx, "router", "llm_result", {
        strategy: "llm",
        provider,
        model,
        rawCategory: raw.trim(),
        resolvedAgent: agentId,
        durationMs: Date.now() - start,
      });

      return { agentId, routedFromGeneral: true };
    } catch (error) {
      emitTrace(ctx, "router", "error", {
        strategy: "llm",
        provider,
        model,
        error: error instanceof Error ? error.message : String(error),
        errorClass: classifyLlmErrorClass(error),
      });

      if (!shouldFallbackToAlternateProvider(error)) {
        // Non-retryable error — fall through to navigator
        break;
      }
      // Try next provider in chain
      continue;
    }
  }

  // Fallback: default to navigator
  emitTrace(ctx, "router", "agent_start", {
    strategy: "fallback",
    agentId: "navigator",
  });
  return { agentId: "navigator", routedFromGeneral: true };
}
