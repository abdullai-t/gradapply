import { stringifyLlmError } from "@/lib/llm-credits";

/**
 * Maps known LLM billing/provider errors into actionable UI text.
 */
export function formatLlmFailureMessage(error: unknown): string {
  const raw = stringifyLlmError(error);

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

  return raw.length > 2000 ? `${raw.slice(0, 2000)}…` : raw;
}
