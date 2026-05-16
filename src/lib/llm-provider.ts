export type LlmProvider = "openrouter" | "groq";

/**
 * Global default backend for one-shot LLM calls (school infer, professor extract, etc.).
 *
 * - Set `AI_PROVIDER=openrouter` or `groq` to force when both keys exist.
 * - Otherwise: **OpenRouter** if `OPENROUTER_API_KEY` is set, else **Groq**.
 *
 * @see https://openrouter.ai/docs/quickstart
 */
export function getLlmProvider(): LlmProvider {
  const explicit = process.env.AI_PROVIDER?.trim().toLowerCase();
  if (explicit === "openrouter") {
    if (!process.env.OPENROUTER_API_KEY?.trim()) {
      throw new Error("AI_PROVIDER=openrouter but OPENROUTER_API_KEY is not set");
    }
    return "openrouter";
  }
  if (explicit === "groq") {
    if (!process.env.GROQ_API_KEY?.trim()) {
      throw new Error("AI_PROVIDER=groq but GROQ_API_KEY is not set");
    }
    return "groq";
  }

  const hasOpenRouter = !!process.env.OPENROUTER_API_KEY?.trim();
  const hasGroq = !!process.env.GROQ_API_KEY?.trim();

  if (hasOpenRouter && !hasGroq) return "openrouter";
  if (hasGroq && !hasOpenRouter) return "groq";
  if (hasOpenRouter) return "openrouter";
  if (hasGroq) return "groq";

  throw new Error(
    "No LLM configured. Set OPENROUTER_API_KEY and/or GROQ_API_KEY.",
  );
}
