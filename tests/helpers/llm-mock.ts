import { vi } from "vitest";

import type { StreamEvent } from "@/lib/agents";

export function mockOrchestratorStream(
  events: StreamEvent[] = [
    { type: "token", content: "Hello" },
    { type: "done", agentId: "orchestrator" },
  ],
) {
  async function* generator() {
    for (const event of events) {
      yield event;
    }
  }

  return {
    stream: generator(),
    finalResult: Promise.resolve({
      reply: "Hello",
      agentId: "orchestrator",
      traceId: "test-trace",
      modelUsed: { provider: "openrouter" as const, model: "test" },
      trace: [],
    }),
  };
}

export function installOrchestratorStreamMock(
  events?: StreamEvent[],
): ReturnType<typeof vi.fn> {
  const spy = vi.fn(() => mockOrchestratorStream(events));
  vi.doMock("@/lib/agents", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/agents")>();
    return {
      ...actual,
      runOrchestratorStream: spy,
      runOrchestrator: vi.fn(),
    };
  });
  return spy;
}
