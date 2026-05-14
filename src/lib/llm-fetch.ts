/**
 * Cloudflare Workers expose fetch, but `nodejs_compat` makes OpenAI/Anthropic SDKs
 * pick node-fetch + keep-alive agents, which fail with APIConnectionError.
 */
export function llmFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  return globalThis.fetch(input, init);
}

export const llmClientOptions = { fetch: llmFetch } as const;
