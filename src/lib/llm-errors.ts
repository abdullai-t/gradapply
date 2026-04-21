import { classifyLlmErrorClass, stringifyLlmError } from "@/lib/llm-credits";

/** Reduce accidental disclosure of server filesystem paths in API error JSON. */
function scrubPathsForClient(s: string): string {
  return s
    .replace(/\/(?:Users|home|var)\/[A-Za-z0-9._/-]+/g, "[path]")
    .replace(/[a-z]:\\[^\s]+/gi, "[path]");
}

/**
 * Maps known LLM billing/provider errors into actionable UI text.
 */
export function formatLlmFailureMessage(error: unknown): string {
  const raw = scrubPathsForClient(stringifyLlmError(error));
  const errorClass = classifyLlmErrorClass(error);

  if (errorClass === "rate_limited" || errorClass === "provider_overloaded") {
    return "The AI provider is currently busy. Please retry in a few moments.";
  }
  if (errorClass === "timeout_or_network") {
    return "The AI request timed out. Please try again.";
  }
  if (errorClass === "provider_saturated" || errorClass === "circuit_open") {
    return "AI capacity is temporarily constrained. Please retry shortly.";
  }
  if (errorClass === "auth_or_config") {
    return "AI service is temporarily unavailable due to provider configuration.";
  }

  if (
    /credit balance is too low/i.test(raw) ||
    /Plans\s*&\s*Billing/i.test(raw) ||
    /Anthropic API/i.test(raw)
  ) {
    return (
      "Anthropic refused this request because the API account has no usable credits. " +
      "Add billing at console.anthropic.com, or add OPENAI_API_KEY / OPENROUTER_API_KEY — " +
      "GradApply rotates providers when quota or credits run out."
    );
  }

  if (
    /\b402\b/.test(raw) ||
    /requires more credits|can only afford|insufficient.?quota|exceeded your.*quota/i.test(
      raw,
    )
  ) {
    return (
      "The LLM provider rejected this request (billing, quota, or token budget). " +
      "Configure more than one of OPENAI_API_KEY, OPENROUTER_API_KEY, and ANTHROPIC_API_KEY — the app switches automatically when possible."
    );
  }

  return "The AI request failed. Please try again shortly.";
}
