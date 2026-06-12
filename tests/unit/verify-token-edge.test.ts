import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  verifyFirebaseIdTokenEdge,
  verifyFirebaseSessionCookieEdge,
} from "@/lib/firebase/verify-token-edge";

vi.mock("@/lib/firebase/config", () => ({
  firebaseProjectId: vi.fn(),
}));

import { firebaseProjectId } from "@/lib/firebase/config";

describe("verifyFirebaseIdTokenEdge", () => {
  beforeEach(() => {
    vi.mocked(firebaseProjectId).mockReturnValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("accepts E2E fixture tokens when enabled", async () => {
    vi.stubEnv("ALLOW_E2E_FIXTURES", "1");
    const decoded = await verifyFirebaseIdTokenEdge("e2e:user-abc:fixture@test.local");
    expect(decoded).toMatchObject({
      sub: "user-abc",
      email: "fixture@test.local",
      email_verified: true,
    });
  });

  it("rejects E2E tokens when fixtures are disabled", async () => {
    vi.stubEnv("ALLOW_E2E_FIXTURES", "0");
    const decoded = await verifyFirebaseIdTokenEdge("e2e:user-abc:fixture@test.local");
    expect(decoded).toBeNull();
  });

  it("returns null without a Firebase project id", async () => {
    const decoded = await verifyFirebaseIdTokenEdge("not-a-jwt");
    expect(decoded).toBeNull();
  });

  it("verifyFirebaseSessionCookieEdge delegates to ID token verify", async () => {
    vi.stubEnv("ALLOW_E2E_FIXTURES", "1");
    const decoded = await verifyFirebaseSessionCookieEdge("e2e:uid-1:a@b.c");
    expect(decoded?.sub).toBe("uid-1");
  });
});
