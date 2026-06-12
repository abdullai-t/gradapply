import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SESSION_COOKIE_NAME } from "@/lib/firebase/session-cookie";

vi.mock("@/lib/firebase/config", () => ({
  isFirebaseConfigured: vi.fn(),
}));

import { isFirebaseConfigured } from "@/lib/firebase/config";
import { middleware } from "@/middleware";

function req(path: string, cookie?: string) {
  const url = `http://localhost:3000${path}`;
  return new NextRequest(url, {
    headers: cookie ? { cookie: `${SESSION_COOKIE_NAME}=${cookie}` } : {},
  });
}

describe("middleware", () => {
  beforeEach(() => {
    vi.mocked(isFirebaseConfigured).mockReturnValue(true);
  });

  it("passes through when Firebase is not configured", async () => {
    vi.mocked(isFirebaseConfigured).mockReturnValue(false);
    const res = await middleware(req("/dashboard"));
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("redirects to login when session cookie is missing", async () => {
    const res = await middleware(req("/dashboard"));
    expect(res.status).toBe(307);
    const location = res.headers.get("location") ?? "";
    expect(location).toContain("/login");
    expect(location).toContain("callbackUrl=%2Fdashboard");
  });

  it("redirects admin paths to admin login", async () => {
    const res = await middleware(req("/admin/users"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login/admin");
  });

  it("allows request when session cookie is present", async () => {
    const res = await middleware(req("/assistant", "firebase-jwt"));
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });
});
