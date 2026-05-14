import Anthropic from "@anthropic-ai/sdk";

import { llmClientOptions } from "@/lib/llm-fetch";

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  ...llmClientOptions,
});
