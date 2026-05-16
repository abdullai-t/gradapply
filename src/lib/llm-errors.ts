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

  if (errorClass === "rate_limited") {
    return "Too many AI requests right now. Please wait a moment and try again.";
  }
  if (errorClass === "provider_overloaded") {
    return "The AI service is under heavy load. Please retry in a few moments.";
  }
  if (errorClass === "timeout_or_network") {
    return "The AI request timed out. Please try again in a moment.";
  }
  if (errorClass === "provider_saturated" || errorClass === "circuit_open") {
    return "AI capacity is temporarily constrained. Please retry shortly.";
  }
  if (errorClass === "auth_or_config") {
    if (/401.*user not found|user not found/i.test(raw)) {
      return (
        "OpenRouter rejected the API key (401 User not found). Regenerate the key at " +
        "https://openrouter.ai/keys and set OPENROUTER_API_KEY, or rely on GROQ_API_KEY if configured."
      );
    }
    if (/No LLM configured|is not configured|is not set/i.test(raw)) {
      return (
        "AI is not configured on this server. Set OPENROUTER_API_KEY and/or GROQ_API_KEY " +
        "in your deployment environment variables."
      );
    }
    return (
      "AI service is temporarily unavailable due to provider configuration. " +
      "Please contact support if this continues."
    );
  }
  if (errorClass === "insufficient_credits") {
    return (
      "The AI provider account is out of quota/credits. " +
      "Please try again later or contact support."
    );
  }
  if (errorClass === "model_unavailable") {
    return (
      "The configured AI model is not available from the provider (it may have been renamed or removed). " +
      "Set AGENT_SCHOOL_INTEL_MODEL, AI_MODEL_SCHOOL_INTEL, or OPENROUTER_MODEL to a current OpenRouter model id."
    );
  }
  if (errorClass === "provider_5xx") {
    return "The AI provider returned a server error. Please retry shortly.";
  }

  if (
    /credit balance is too low/i.test(raw) ||
    /Plans\s*&\s*Billing/i.test(raw) ||
    /Anthropic API/i.test(raw)
  ) {
    return (
      "The AI provider account is out of quota or credits for this request. " +
      "Add credits on OpenRouter or Groq, or set both OPENROUTER_API_KEY and GROQ_API_KEY so the app can fall back."
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
      "Configure both OPENROUTER_API_KEY and GROQ_API_KEY when possible — the app switches automatically when one backend fails."
    );
  }

  if (
    /\b400\b/.test(raw) ||
    /invalid request|context length|maximum context|max tokens|prompt too long|too many tokens/i.test(
      raw,
    )
  ) {
    return (
      "This AI request was too large or invalid for the current model. " +
      "Please shorten your input and try again."
    );
  }

  if (/Could not parse JSON from model output/i.test(raw)) {
    return "The AI returned an unreadable response. Please try again in a moment.";
  }

  return "The AI service could not process this request. Please retry shortly.";
}
