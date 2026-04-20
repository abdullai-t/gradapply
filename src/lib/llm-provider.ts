export type LlmProvider = "anthropic" | "openrouter" | "openai";

/**
 * Global default backend for one-shot LLM calls (school infer, professor extract, etc.).
 *
 * - Set `AI_PROVIDER=openrouter`, `anthropic`, or `openai` to force when multiple keys exist.
 * - Otherwise: **OpenRouter is preferred** whenever `OPENROUTER_API_KEY` is set alongside other keys.
 *   If OpenRouter is not configured: native OpenAI beats Anthropic when both exist.
 *
 * @see https://openrouter.ai/docs/quickstart
 */
export function getLlmProvider(): LlmProvider {
  const explicit = process.env.AI_PROVIDER?.trim().toLowerCase();
  if (
    explicit === "openrouter" ||
    explicit === "anthropic" ||
    explicit === "openai"
  ) {
    if (explicit === "openrouter") {
      if (!process.env.OPENROUTER_API_KEY?.trim()) {
        throw new Error(
          "AI_PROVIDER=openrouter but OPENROUTER_API_KEY is not set",
        );
      }
      return "openrouter";
    }
    if (explicit === "anthropic") {
      if (!process.env.ANTHROPIC_API_KEY?.trim()) {
        throw new Error(
          "AI_PROVIDER=anthropic but ANTHROPIC_API_KEY is not set",
        );
      }
      return "anthropic";
    }
    if (!process.env.OPENAI_API_KEY?.trim()) {
      throw new Error("AI_PROVIDER=openai but OPENAI_API_KEY is not set");
    }
    return "openai";
  }

  const hasOpenRouter = !!process.env.OPENROUTER_API_KEY?.trim();
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY?.trim();
  const hasOpenAi = !!process.env.OPENAI_API_KEY?.trim();

  if (hasOpenRouter && !hasAnthropic && !hasOpenAi) return "openrouter";
  if (hasAnthropic && !hasOpenRouter && !hasOpenAi) return "anthropic";
  if (hasOpenAi && !hasOpenRouter && !hasAnthropic) return "openai";

  /** Prefer OpenRouter whenever that key exists with other providers. */
  if (hasOpenRouter) return "openrouter";

  /** OpenAI + Anthropic only: prefer native OpenAI. */
  if (hasOpenAi) return "openai";

  throw new Error(
    "No LLM configured. Set OPENROUTER_API_KEY, ANTHROPIC_API_KEY, and/or OPENAI_API_KEY (see .env.example).",
  );
}
