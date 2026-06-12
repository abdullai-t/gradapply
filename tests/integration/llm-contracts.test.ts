import { describe, expect, it, vi } from "vitest";

import { inferTaskFromGeneralMessage } from "@/lib/agents/router-prompt";
import {
  classifyLlmErrorClass,
  orderedFallbackProviders,
  shouldFallbackToAlternateProvider,
} from "@/lib/llm-credits";

import { mockOrchestratorStream } from "../helpers/llm-mock";

describe("LLM router regex fast-path", () => {
  it("skips LLM for known SOP phrasing", () => {
    expect(inferTaskFromGeneralMessage("help with my personal statement")).toBe(
      "sop",
    );
  });

  it("does not mis-route faculty search to email agent", () => {
    expect(
      inferTaskFromGeneralMessage("list faculty working on NLP at Berkeley"),
    ).toBeNull();
  });
});

describe("LLM provider fallback contract", () => {
  it("429 from primary triggers fallback eligibility", () => {
    const err = new Error("429 rate limit");
    expect(classifyLlmErrorClass(err)).toBe("rate_limited");
    expect(shouldFallbackToAlternateProvider(err)).toBe(true);
  });

  it("orderedFallbackProviders never calls live APIs in tests", () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-or");
    vi.stubEnv("GROQ_API_KEY", "test-groq");
    const order = orderedFallbackProviders("groq");
    expect(order[0]).toBe("groq");
    expect(order).toContain("openrouter");
    vi.unstubAllEnvs();
  });
});

describe("SSE stream contract (mocked orchestrator)", () => {
  it("emits token events before done", async () => {
    const events = [
      { type: "token" as const, content: "Hel" },
      { type: "token" as const, content: "lo" },
      { type: "done" as const, agentId: "orchestrator" },
    ];
    const { stream } = mockOrchestratorStream(events);
    const collected: string[] = [];
    for await (const event of stream) {
      if (event.type === "token") collected.push(event.content);
    }
    expect(collected.join("")).toBe("Hello");
  });
});
