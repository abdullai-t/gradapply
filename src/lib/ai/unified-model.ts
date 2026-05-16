import type { LlmProvider } from "@/lib/llm-provider";

/**
 * Maps env-driven feature slugs (`AI_MODEL_*`, defaults in `models.ts`) to OpenRouter or Groq.
 *
 * - `groq/<model>` → Groq OpenAI-compatible API.
 * - `openrouter/<id>` → OpenRouter with model id `<id>` (e.g. `openrouter/anthropic/claude-sonnet-4`).
 * - Any other `vendor/model` pair (e.g. `anthropic/claude-sonnet-4`, `openai/gpt-4o-mini`) → OpenRouter catalog.
 */
export function providerModelFromUnifiedSlug(slug: string): {
  provider: LlmProvider;
  model: string;
} {
  const slash = slug.indexOf("/");
  if (slash <= 0 || slash === slug.length - 1) {
    throw new Error(`Invalid model slug: ${slug}`);
  }
  const prefix = slug.slice(0, slash).toLowerCase();
  const tail = slug.slice(slash + 1);

  if (prefix === "groq") {
    return { provider: "groq", model: tail };
  }
  if (prefix === "openrouter") {
    return { provider: "openrouter", model: tail };
  }
  return { provider: "openrouter", model: slug };
}
