import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/auth/me/route";

vi.mock("@/lib/firebase/server-session", () => ({
  getSessionTokenFromCookies: vi.fn(),
}));

vi.mock("@/lib/firebase/verify-token-edge", () => ({
  verifyFirebaseSessionCookieEdge: vi.fn(),
}));

vi.mock("@/lib/firebase/user-sync", () => ({
  ensureAppUserFromFirebaseToken: vi.fn(),
}));

vi.mock("@/lib/admin-auth", () => ({
  getCurrentUserRole: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  log: { error: vi.fn() },
}));

import { getCurrentUserRole } from "@/lib/admin-auth";
import { getSessionTokenFromCookies } from "@/lib/firebase/server-session";
import { ensureAppUserFromFirebaseToken } from "@/lib/firebase/user-sync";
import { verifyFirebaseSessionCookieEdge } from "@/lib/firebase/verify-token-edge";

describe("GET /api/auth/me", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without a session cookie", async () => {
    vi.mocked(getSessionTokenFromCookies).mockResolvedValue(null);
    const res = await GET(new Request("http://localhost:3000/api/auth/me"));
    expect(res.status).toBe(401);
  });

  it("returns 401 for invalid session token", async () => {
    vi.mocked(getSessionTokenFromCookies).mockResolvedValue("bad");
    vi.mocked(verifyFirebaseSessionCookieEdge).mockResolvedValue(null);
    const res = await GET(new Request("http://localhost:3000/api/auth/me"));
    expect(res.status).toBe(401);
  });

  it("returns user profile for valid session", async () => {
    vi.mocked(getSessionTokenFromCookies).mockResolvedValue("token");
    vi.mocked(verifyFirebaseSessionCookieEdge).mockResolvedValue({
      sub: "uid-1",
      email: "u@test.local",
    });
    vi.mocked(ensureAppUserFromFirebaseToken).mockResolvedValue({
      id: "uid-1",
      email: "u@test.local",
      name: "User",
      image: null,
      role: "USER",
    } as never);
    const res = await GET(new Request("http://localhost:3000/api/auth/me"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.id).toBe("uid-1");
  });

  it("blocks admin probe for non-admin users", async () => {
    vi.mocked(getSessionTokenFromCookies).mockResolvedValue("token");
    vi.mocked(verifyFirebaseSessionCookieEdge).mockResolvedValue({
      sub: "uid-1",
    });
    vi.mocked(ensureAppUserFromFirebaseToken).mockResolvedValue({
      id: "uid-1",
      email: "u@test.local",
      name: "User",
      image: null,
      role: "USER",
    } as never);
    vi.mocked(getCurrentUserRole).mockResolvedValue("USER");
    const res = await GET(
      new Request("http://localhost:3000/api/auth/me?admin=1"),
    );
    expect(res.status).toBe(403);
  });

  it("returns 503 when provisioning fails", async () => {
    vi.mocked(getSessionTokenFromCookies).mockResolvedValue("token");
    vi.mocked(verifyFirebaseSessionCookieEdge).mockResolvedValue({
      sub: "uid-1",
    });
    vi.mocked(ensureAppUserFromFirebaseToken).mockRejectedValue(
      new Error("db down"),
    );
    const res = await GET(new Request("http://localhost:3000/api/auth/me"));
    expect(res.status).toBe(503);
  });
});
