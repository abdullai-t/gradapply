import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/firebase/server-session", () => ({
  getAppSession: vi.fn(),
}));

vi.mock("@/lib/firebase/config", () => ({
  isFirebaseConfigured: vi.fn(),
}));

import { auth, getAuthSetupStatus } from "@/auth";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { getAppSession } from "@/lib/firebase/server-session";

describe("auth()", () => {
  it("delegates to getAppSession", async () => {
    const session = { user: { id: "u1", email: "a@b.c", role: "USER" as const } };
    vi.mocked(getAppSession).mockResolvedValue(session);
    await expect(auth()).resolves.toEqual(session);
  });
});

describe("getAuthSetupStatus", () => {
  it("reports providers when Firebase is configured", () => {
    vi.mocked(isFirebaseConfigured).mockReturnValue(true);
    expect(getAuthSetupStatus()).toEqual({
      hasGoogle: true,
      hasEmail: true,
      hasFirebase: true,
      providerCount: 2,
    });
  });

  it("reports no providers when Firebase is not configured", () => {
    vi.mocked(isFirebaseConfigured).mockReturnValue(false);
    expect(getAuthSetupStatus()).toEqual({
      hasGoogle: false,
      hasEmail: false,
      hasFirebase: false,
      providerCount: 0,
    });
  });
});
