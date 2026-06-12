import { beforeEach, describe, expect, it, vi } from "vitest";

import { history } from "@/server/chat/history-handler";

import { prismaMock } from "../setup";
import { buildJsonRequest, trustedOriginHeaders } from "../helpers/auth-headers";

vi.mock("@/auth", () => ({
  auth: vi.fn(async () => ({
    user: { id: "user-1", email: "u@test.local", role: "USER" },
  })),
}));

vi.mock("@/lib/plan-gates", () => ({
  getUserPlanTier: vi.fn(),
}));

vi.mock("@/server/chat/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/chat/shared")>();
  return {
    ...actual,
    chatSupportsSchoolScope: vi.fn(async () => true),
  };
});

import { getUserPlanTier } from "@/lib/plan-gates";

describe("chat history handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.chatMessage.findMany.mockResolvedValue([]);
  });

  it("returns 402 for FREE plan", async () => {
    vi.mocked(getUserPlanTier).mockResolvedValue("FREE");
    const req = new Request(
      "http://localhost:3000/api/chat/history?mode=general",
      { headers: trustedOriginHeaders() },
    );
    const res = await history(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.code).toBe("PLAN_UPGRADE_REQUIRED");
  });

  it("returns messages for PLUS plan", async () => {
    vi.mocked(getUserPlanTier).mockResolvedValue("PLUS");
    prismaMock.chatMessage.findMany.mockResolvedValue([
      { id: "1", role: "user", content: "hi", mode: "general", schoolId: null },
    ]);
    const req = new Request(
      "http://localhost:3000/api/chat/history?mode=general",
      { headers: trustedOriginHeaders() },
    );
    const res = await history(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
  });
});

describe("chat send handler CSRF", () => {
  it("rejects POST without trusted origin via withAuth", async () => {
    const { send } = await import("@/server/chat/send-handler");
    const req = new Request("http://localhost:3000/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://evil.com" },
      body: JSON.stringify({ mode: "general", message: "hi" }),
    });
    const res = await send(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(403);
  });
});

describe("chat send FREE plan gate", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns 402 PLAN_UPGRADE_REQUIRED for FREE users", async () => {
    vi.doMock("@/auth", () => ({
      auth: vi.fn(async () => ({
        user: { id: "free-user", email: "f@test.local", role: "USER" },
      })),
    }));
    vi.doMock("@/lib/plan-gates", () => ({
      getUserPlanTier: vi.fn(async () => "FREE"),
      requireNonFreeForFeature: vi.fn(async () =>
        Response.json(
          { code: "PLAN_UPGRADE_REQUIRED", feature: "assistant" },
          { status: 402 },
        ),
      ),
      requireWritableAccount: vi.fn(async () => null),
    }));
    const { send } = await import("@/server/chat/send-handler");
    const req = buildJsonRequest("http://localhost:3000/api/chat", {
      method: "POST",
      json: { mode: "general", message: "hello" },
    });
    const res = await send(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(402);
  });
});
