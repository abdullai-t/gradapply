import { beforeEach, describe, expect, it, vi } from "vitest";

import { runHealthCheck } from "@/lib/health-check";

import { prismaMock } from "../setup";

vi.mock("@/lib/build-version", () => ({
  getAppVersion: vi.fn(() => "1.7.0-test"),
}));

describe("runHealthCheck", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns ok when database responds", async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);
    const result = await runHealthCheck();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.version).toBe("1.7.0-test");
      expect(result.dbMs).toBeGreaterThanOrEqual(0);
    }
  });

  it("returns database error when query fails", async () => {
    prismaMock.$queryRaw.mockRejectedValue(new Error("connection refused"));
    const result = await runHealthCheck();
    expect(result).toEqual({
      ok: false,
      error: "database",
      dbMs: expect.any(Number),
    });
  });
});
