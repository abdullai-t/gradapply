import { afterEach, describe, expect, it, vi } from "vitest";

import { PATCH, POST, DELETE } from "@/app/api/auth/session/route";
import { SESSION_COOKIE_NAME } from "@/lib/firebase/session-cookie";

import { buildJsonRequest } from "../helpers/auth-headers";

vi.mock("@/lib/firebase/verify-token-edge", () => ({
  verifyFirebaseIdTokenEdge: vi.fn(),
}));

vi.mock("@/lib/upstash-rate-limit", () => ({
  getClientIpFromRequest: vi.fn(() => "127.0.0.1"),
  assertSessionPostAllowedByIp: vi.fn(async () => ({ ok: true as const })),
}));

import { verifyFirebaseIdTokenEdge } from "@/lib/firebase/verify-token-edge";
import { assertSessionPostAllowedByIp } from "@/lib/upstash-rate-limit";

describe("POST /api/auth/session", () => {
  afterEach(() => {
    vi.mocked(verifyFirebaseIdTokenEdge).mockReset();
    vi.mocked(assertSessionPostAllowedByIp).mockReset();
    vi.mocked(assertSessionPostAllowedByIp).mockResolvedValue({ ok: true });
  });

  it("sets session cookie for valid token", async () => {
    vi.mocked(verifyFirebaseIdTokenEdge).mockResolvedValue({
      sub: "user-123",
      email: "u@test.local",
    });
    const req = buildJsonRequest("http://localhost:3000/api/auth/session", {
      method: "POST",
      json: { idToken: "valid-token" },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(SESSION_COOKIE_NAME);
  });

  it("returns 401 for invalid token", async () => {
    vi.mocked(verifyFirebaseIdTokenEdge).mockResolvedValue(null);
    const req = buildJsonRequest("http://localhost:3000/api/auth/session", {
      method: "POST",
      json: { idToken: "bad" },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 403 without trusted origin", async () => {
    const req = new Request("http://localhost:3000/api/auth/session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://evil.com",
      },
      body: JSON.stringify({ idToken: "x" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("returns 429 when rate limited", async () => {
    vi.mocked(assertSessionPostAllowedByIp).mockResolvedValue({
      ok: false,
      retryAfterSec: 60,
    });
    const req = buildJsonRequest("http://localhost:3000/api/auth/session", {
      method: "POST",
      json: { idToken: "x" },
    });
    const res = await POST(req);
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("60");
  });

  it("returns 400 when idToken is missing", async () => {
    const req = buildJsonRequest("http://localhost:3000/api/auth/session", {
      method: "POST",
      json: {},
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("PATCH delegates to POST", async () => {
    vi.mocked(verifyFirebaseIdTokenEdge).mockResolvedValue({
      sub: "user-123",
      email: "u@test.local",
    });
    const req = buildJsonRequest("http://localhost:3000/api/auth/session", {
      method: "PATCH",
      json: { idToken: "valid-token" },
    });
    const res = await PATCH(req);
    expect(res.status).toBe(200);
  });

  it("clears cookie on DELETE", async () => {
    const req = buildJsonRequest("http://localhost:3000/api/auth/session", {
      method: "DELETE",
    });
    const res = await DELETE(req);
    expect(res.status).toBe(200);
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(`${SESSION_COOKIE_NAME}=`);
    expect(setCookie.toLowerCase()).toMatch(/max-age=0|expires=/);
  });
});
