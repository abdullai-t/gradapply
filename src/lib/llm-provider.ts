import { isAiGatewayEnabled } from "@/lib/ai/gateway";

export type LlmProvider =
  | "anthropic"
  | "openrouter"
  | "openai"
  | "groq"
  | "gemini";

/**
 * Global default backend for one-shot LLM calls (school infer, professor extract, etc.).
 *
 * - Set `AI_PROVIDER=aigateway` to route via Cloudflare AI Gateway (requires `CF_AI_GATEWAY_ACCOUNT_ID` + `CF_AI_GATEWAY_TOKEN`).
 * - Set `AI_PROVIDER=gemini`, `openrouter`, `anthropic`, `openai`, or `groq` to force when multiple keys exist.
 * - Otherwise, default order is: **OpenRouter -> Anthropic -> OpenAI -> Gemini -> Groq**.
 *
 * @see https://openrouter.ai/docs/quickstart
 */
export function getLlmProvider(): LlmProvider {
  const explicit = process.env.AI_PROVIDER?.trim().toLowerCase();
  if (explicit === "aigateway" || explicit === "gateway") {
    if (!isAiGatewayEnabled()) {
      throw new Error(
        "AI_PROVIDER=aigateway but CF_AI_GATEWAY_ACCOUNT_ID and CF_AI_GATEWAY_TOKEN are not set",
      );
    }
    if (process.env.OPENROUTER_API_KEY?.trim()) return "openrouter";
    if (process.env.ANTHROPIC_API_KEY?.trim()) return "anthropic";
    if (process.env.OPENAI_API_KEY?.trim()) return "openai";
    if (process.env.GEMINI_API_KEY?.trim()) return "gemini";
    if (process.env.GROQ_API_KEY?.trim()) return "groq";
    return "openai";
  }
  if (
    explicit === "gemini" ||
    explicit === "openrouter" ||
    explicit === "anthropic" ||
    explicit === "openai" ||
    explicit === "groq"
  ) {
    if (explicit === "gemini") {
      if (!process.env.GEMINI_API_KEY?.trim()) {
        throw new Error("AI_PROVIDER=gemini but GEMINI_API_KEY is not set");
      }
      return "gemini";
    }
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
    if (explicit === "groq") {
      if (!process.env.GROQ_API_KEY?.trim()) {
        throw new Error("AI_PROVIDER=groq but GROQ_API_KEY is not set");
      }
      return "groq";
    }
    if (!process.env.OPENAI_API_KEY?.trim()) {
      throw new Error("AI_PROVIDER=openai but OPENAI_API_KEY is not set");
    }
    return "openai";
  }

  const hasOpenRouter = !!process.env.OPENROUTER_API_KEY?.trim();
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY?.trim();
  const hasOpenAi = !!process.env.OPENAI_API_KEY?.trim();
  const hasGroq = !!process.env.GROQ_API_KEY?.trim();
  const hasGemini = !!process.env.GEMINI_API_KEY?.trim();

  if (hasAnthropic && !hasOpenRouter && !hasOpenAi && !hasGroq && !hasGemini) return "anthropic";
  if (hasOpenAi && !hasOpenRouter && !hasAnthropic && !hasGroq && !hasGemini) return "openai";
  if (hasGemini && !hasOpenRouter && !hasAnthropic && !hasOpenAi && !hasGroq) {
    return "gemini";
  }
  if (hasOpenRouter && !hasAnthropic && !hasOpenAi && !hasGroq && !hasGemini) return "openrouter";
  if (hasGroq && !hasOpenRouter && !hasAnthropic && !hasOpenAi && !hasGemini) return "groq";

  /** Multi-provider precedence: OpenRouter first, then Anthropic, OpenAI, Gemini, Groq. */
  if (hasOpenRouter) return "openrouter";
  if (hasAnthropic) return "anthropic";
  if (hasOpenAi) return "openai";
  if (hasGemini) return "gemini";
  if (hasGroq) return "groq";

  if (isAiGatewayEnabled()) {
    if (hasOpenRouter) return "openrouter";
    if (hasAnthropic) return "anthropic";
    if (hasOpenAi) return "openai";
    if (hasGemini) return "gemini";
    if (hasGroq) return "groq";
    return "openai";
  }

  throw new Error(
    "No LLM configured. Set GEMINI_API_KEY, OPENROUTER_API_KEY, ANTHROPIC_API_KEY, OPENAI_API_KEY, and/or GROQ_API_KEY.",
  );
}
