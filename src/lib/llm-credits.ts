import type { LlmProvider } from "@/lib/llm-provider";
import { isAiGatewayByok, isAiGatewayEnabled } from "@/lib/ai/gateway";

export function stringifyLlmError(error: unknown): string {
  const parts: string[] = [];

  function walk(err: unknown, depth: number) {
    if (depth > 4) return;
    if (err instanceof Error) {
      parts.push(err.message);
      const anyErr = err as Error & {
        status?: number;
        statusCode?: number;
        code?: string;
        response?: unknown;
        cause?: unknown;
      };
      if (typeof anyErr.status === "number") parts.push(String(anyErr.status));
      if (typeof anyErr.statusCode === "number") parts.push(String(anyErr.statusCode));
      if (typeof anyErr.code === "string") parts.push(anyErr.code);
      if (anyErr.response !== undefined) {
        try {
          parts.push(JSON.stringify(anyErr.response));
        } catch {
          parts.push(String(anyErr.response));
        }
      }
      if (anyErr.cause !== undefined) walk(anyErr.cause, depth + 1);
    } else if (typeof err === "string") {
      parts.push(err);
    } else if (err && typeof err === "object") {
      try {
        parts.push(JSON.stringify(err));
      } catch {
        parts.push(String(err));
      }
    } else {
      parts.push(String(err));
    }
  }

  walk(error, 0);
  return parts.join(" ");
}

/** OpenRouter 402 / insufficient balance, OpenAI quota, Anthropic billing, etc. */
export function isInsufficientCreditsError(error: unknown): boolean {
  const raw = stringifyLlmError(error);
  return (
    /\b402\b/.test(raw) ||
    /requires more credits/i.test(raw) ||
    /can only afford/i.test(raw) ||
    /not enough credits/i.test(raw) ||
    /insufficient[_ ]quota/i.test(raw) ||
    /credit balance is too low/i.test(raw) ||
    /Plans\s*&\s*Billing/i.test(raw) ||
    /rate[_ ]limit.*billing/i.test(raw)
  );
}

/**
 * Missing env key for a provider in the agent chain — skip to the next backend.
 */
export function isProviderNotConfiguredError(error: unknown): boolean {
  const raw = stringifyLlmError(error);
  return (
    /is not configured|is not set/i.test(raw) ||
    /No LLM configured/i.test(raw)
  );
}

/**
 * Don’t rotate API keys — bad credentials won’t be fixed by trying another provider.
 */
export function isLikelyAuthOrConfigError(error: unknown): boolean {
  const raw = stringifyLlmError(error);
  if (isProviderNotConfiguredError(error)) return true;
  return (
    /invalid[_ ]api[_ ]key|incorrect api key|no api key provided|missing api key/i.test(
      raw,
    ) ||
    /authentication failed/i.test(raw) ||
    /\b401\b/.test(raw)
  );
}

export function classifyLlmErrorClass(error: unknown): string {
  const raw = stringifyLlmError(error);
  if (/LLM_PROVIDER_CIRCUIT_OPEN/.test(raw)) return "circuit_open";
  if (/LLM_PROVIDER_SATURATED/.test(raw)) return "provider_saturated";
  if (isLikelyAuthOrConfigError(error)) return "auth_or_config";
  if (isInsufficientCreditsError(error)) return "insufficient_credits";
  if (/\b400\b|bad request/i.test(raw)) return "bad_request";
  if (/\b429\b|too many requests|rate[_ ]limit/i.test(raw)) return "rate_limited";
  if (/\b503\b|overloaded|capacity/i.test(raw)) return "provider_overloaded";
  if (/\b5\d\d\b/.test(raw)) return "provider_5xx";
  if (/timeout|timed out|ETIMEDOUT|ECONNRESET|EAI_AGAIN|socket hang up|connection error|failed to fetch|fetch failed|ENOTFOUND|ECONNREFUSED/i.test(raw)) {
    return "timeout_or_network";
  }
  return "unknown";
}

/**
 * Provider/billing/quota/status conditions where trying another configured LLM may succeed.
 */
export function shouldFallbackToAlternateProvider(error: unknown): boolean {
  if (isProviderNotConfiguredError(error)) return true;
  const kind = classifyLlmErrorClass(error);
  if (kind === "circuit_open" || kind === "provider_saturated") return true;
  if (kind === "bad_request") return true;
  if (isLikelyAuthOrConfigError(error)) return false;

  const raw = stringifyLlmError(error);

  if (isInsufficientCreditsError(error)) return true;

  // OpenAI / generic quota & billing
  if (
    /billing_hard_limit|exceeded your (current )?quota|does not have enough|insufficient[_ ]fund/i.test(
      raw,
    )
  )
    return true;

  // Payment / plan
  if (/\bpayment_required\b|\b402\b/i.test(raw)) return true;

  // Often indicates account tier / credits (still worth trying another backend)
  if (/\b429\b/.test(raw)) return true;
  if (/too many requests|rate[_ ]limit/i.test(raw)) return true;

  // Over capacity — another provider might work
  if (/\b503\b|overloaded|capacity/i.test(raw)) return true;
  if (/timeout|timed out|ETIMEDOUT|ECONNRESET|EAI_AGAIN|socket hang up|connection error|failed to fetch|fetch failed|ENOTFOUND|ECONNREFUSED/i.test(raw)) {
    return true;
  }

  return false;
}

/**
 * OpenRouter returns text like "can only afford 2628" — use a slightly lower cap.
 */
export function parseAffordableMaxTokens(error: unknown): number | null {
  const raw = stringifyLlmError(error);
  const m = /can only afford (\d+)/i.exec(raw);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n < 64) return null;
  return Math.max(256, Math.floor(n * 0.92));
}

/**
 * Providers that have env keys, in **fallback rotation order** after the primary fails.
 * OpenRouter first, then Anthropic, OpenAI, Gemini, Groq.
 */
export function providersWithKeysOrdered(): LlmProvider[] {
  if (isAiGatewayEnabled() && !isAiGatewayByok()) {
    return ["openrouter", "anthropic", "openai", "gemini", "groq"];
  }
  const list: LlmProvider[] = [];
  if (process.env.OPENROUTER_API_KEY?.trim()) list.push("openrouter");
  if (process.env.ANTHROPIC_API_KEY?.trim()) list.push("anthropic");
  if (process.env.OPENAI_API_KEY?.trim()) list.push("openai");
  if (process.env.GEMINI_API_KEY?.trim()) list.push("gemini");
  if (process.env.GROQ_API_KEY?.trim()) list.push("groq");
  return list;
}

/** Prefer `primary` first; then every other configured backend in a stable order. */
export function orderedFallbackProviders(primary: LlmProvider): LlmProvider[] {
  const all = providersWithKeysOrdered();
  if (all.length === 0) {
    if (isAiGatewayEnabled()) {
      const fallback: LlmProvider[] = [
        primary,
        "openrouter",
        "anthropic",
        "openai",
        "gemini",
        "groq",
      ];
      return fallback.filter((p, i, arr) => arr.indexOf(p) === i);
    }
    throw new Error(
      "No LLM configured. Set CF_AI_GATEWAY_ACCOUNT_ID + CF_AI_GATEWAY_TOKEN, or set GEMINI_API_KEY, OPENROUTER_API_KEY, ANTHROPIC_API_KEY, OPENAI_API_KEY, or GROQ_API_KEY.",
    );
  }
  const rest = all.filter((p) => p !== primary);
  return all.includes(primary) ? [primary, ...rest] : all;
}
