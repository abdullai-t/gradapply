import { beforeEach, describe, expect, it, vi } from "vitest";

import { mockOrchestratorStream } from "../helpers/llm-mock";
import { buildJsonRequest, trustedOriginHeaders } from "../helpers/auth-headers";
import { prismaMock } from "../setup";

vi.mock("@/auth", () => ({
  auth: vi.fn(async () => ({
    user: { id: "user-1", email: "u@test.local", role: "USER" },
  })),
}));

vi.mock("@/lib/plan-gates", () => ({
  getUserPlanTier: vi.fn(async () => "PLUS"),
  requireNonFreeForFeature: vi.fn(async () => null),
  requireWritableAccount: vi.fn(async () => null),
}));

vi.mock("@/lib/upstash-rate-limit", () => ({
  assertChatPostAllowedForUser: vi.fn(async () => ({ ok: true as const })),
}));

vi.mock("@/lib/billing-allowance", () => ({
  billingPrecheckResponse: vi.fn(async () => null),
  finalizeAiConsumption: vi.fn(async () => undefined),
}));

vi.mock("@/lib/user-activity", () => ({
  touchUserActivityAsync: vi.fn(),
}));

vi.mock("@/lib/agents", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/agents")>();
  return {
    ...actual,
    runOrchestrator: vi.fn(),
    runOrchestratorStream: vi.fn(),
  };
});

vi.mock("@/server/chat/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/chat/shared")>();
  return {
    ...actual,
    chatSupportsSchoolScope: vi.fn(async () => false),
  };
});

import { runOrchestrator, runOrchestratorStream } from "@/lib/agents";
import { billingPrecheckResponse } from "@/lib/billing-allowance";
import {
  requireNonFreeForFeature,
  requireWritableAccount,
} from "@/lib/plan-gates";
import { assertChatPostAllowedForUser } from "@/lib/upstash-rate-limit";
import { send } from "@/server/chat/send-handler";

describe("chat send handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireNonFreeForFeature).mockResolvedValue(null);
    vi.mocked(requireWritableAccount).mockResolvedValue(null);
    vi.mocked(billingPrecheckResponse).mockResolvedValue(null);
    vi.mocked(assertChatPostAllowedForUser).mockResolvedValue({ ok: true });
    prismaMock.chatMessage.findMany.mockResolvedValue([]);
    prismaMock.chatMessage.create.mockResolvedValue({});
    prismaMock.$transaction.mockImplementation(async (ops: unknown) => {
      if (typeof ops === "function") return ops(prismaMock);
      if (Array.isArray(ops)) return Promise.all(ops);
      return ops;
    });
  });

  it("returns 400 for invalid payload", async () => {
    const req = buildJsonRequest("http://localhost:3000/api/chat", {
      method: "POST",
      json: { mode: "sop", message: "" },
    });
    const res = await send(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(400);
  });

  it("returns 429 when chat rate limit is exceeded", async () => {
    vi.mocked(assertChatPostAllowedForUser).mockResolvedValue({
      ok: false,
      retryAfterSec: 30,
    });
    const req = buildJsonRequest("http://localhost:3000/api/chat", {
      method: "POST",
      json: { mode: "sop", message: "hello" },
    });
    const res = await send(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(429);
  });

  it("returns 402 when billing precheck fails", async () => {
    vi.mocked(assertChatPostAllowedForUser).mockResolvedValue({ ok: true });
    vi.mocked(billingPrecheckResponse).mockResolvedValue(
      Response.json({ code: "AI_QUOTA_EXCEEDED" }, { status: 402 }),
    );
    const req = buildJsonRequest("http://localhost:3000/api/chat", {
      method: "POST",
      json: { mode: "sop", message: "hello" },
    });
    const res = await send(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(402);
  });

  it("returns assistant reply on non-streaming success", async () => {
    vi.mocked(runOrchestrator).mockResolvedValue({
      reply: "Here is help",
      agentId: "orchestrator",
      traceId: "trace-1",
      modelUsed: { provider: "openrouter", model: "test" },
      trace: [],
    });
    const req = buildJsonRequest("http://localhost:3000/api/chat", {
      method: "POST",
      json: { mode: "sop", message: "help me" },
    });
    const res = await send(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reply).toBe("Here is help");
    expect(prismaMock.$transaction).toHaveBeenCalled();
  });

  it("streams SSE events when stream=true", async () => {
    vi.mocked(runOrchestratorStream).mockReturnValue(
      mockOrchestratorStream([
        { type: "token", content: "Hi" },
        { type: "done", agentId: "orchestrator" },
      ]),
    );
    const req = buildJsonRequest("http://localhost:3000/api/chat", {
      method: "POST",
      json: { mode: "sop", message: "stream please", stream: true },
    });
    const res = await send(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const text = await res.text();
    expect(text).toContain('"type":"token"');
    expect(text).toContain("[DONE]");
  });
});
