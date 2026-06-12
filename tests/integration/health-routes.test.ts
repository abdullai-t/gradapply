import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET as healthGet } from "@/app/api/health/route";
import { GET as authHealthGet } from "@/app/api/auth/health/route";

import { prismaMock } from "../setup";

vi.mock("@/lib/build-version", () => ({
  getAppVersion: vi.fn(() => "1.7.0-test"),
}));

vi.mock("@/lib/firebase/config", () => ({
  isFirebaseConfigured: vi.fn(() => true),
}));

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 when database is healthy", async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);
    const res = await healthGet();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, version: "1.7.0-test" });
  });

  it("returns 503 when database check fails", async () => {
    prismaMock.$queryRaw.mockRejectedValue(new Error("down"));
    const res = await healthGet();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body).toEqual({ ok: false, error: "database" });
  });
});

describe("GET /api/auth/health", () => {
  it("reports auth setup and origin details", async () => {
    const req = new Request("http://localhost:3000/api/auth/health", {
      headers: { host: "localhost:3000" },
    });
    const res = await authHealthGet(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.auth.hasFirebase).toBe(true);
    expect(body.firebase.emailLinkFinishUrl).toContain("/auth/email-link");
    expect(res.headers.get("cache-control")).toContain("no-store");
  });
});
