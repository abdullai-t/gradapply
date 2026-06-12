import { createHmac } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

import { POST as sessionPost } from "@/app/api/auth/session/route";
import { isSafeAuthRedirectPath } from "@/lib/auth-redirect";
import { assertHttpUrlFetchAllowedSync } from "@/lib/profile-page-fetch";
import { billingPrecheckResponse } from "@/lib/billing-allowance";
import { POST as paystackWebhookPost } from "@/app/api/webhooks/paystack/route";

import { buildJsonRequest } from "../helpers/auth-headers";
import { prismaMock } from "../setup";

/**
 * Traceability: docs/SECURITY.md → automated regression checks.
 * See tests/README.md for the full mapping table.
 */

vi.mock("@/lib/billing-admin-config", () => ({
  getBillingAdminConfig: vi.fn(async () => ({
    paystackSecretKey: undefined,
    creditsPackSize: 50,
    allowance: { FREE: 0, PLUS: 500, PRO: 2000 },
    freeSignupCredits: 10,
  })),
}));

vi.mock("@/lib/firebase/verify-token-edge", () => ({
  verifyFirebaseIdTokenEdge: vi.fn(async () => ({ sub: "u1" })),
}));

vi.mock("@/lib/upstash-rate-limit", () => ({
  getClientIpFromRequest: vi.fn(() => "1.2.3.4"),
  assertSessionPostAllowedByIp: vi.fn(async () => ({ ok: true as const })),
}));

vi.mock("@/lib/paystack-fulfillment", () => ({
  processPaystackReference: vi.fn(),
}));

describe("SECURITY.md — CSRF on session POST", () => {
  it("rejects untrusted Origin", async () => {
    const req = new Request("http://localhost:3000/api/auth/session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://attacker.example",
      },
      body: JSON.stringify({ idToken: "x" }),
    });
    expect((await sessionPost(req)).status).toBe(403);
  });
});

describe("SECURITY.md — open redirect", () => {
  it("blocks protocol-relative callback paths", () => {
    expect(isSafeAuthRedirectPath("//evil.com")).toBe(false);
  });
});

describe("SECURITY.md — Paystack webhook HMAC", () => {
  it("rejects missing signature", async () => {
    const req = new Request("http://localhost/api/webhooks/paystack", {
      method: "POST",
      body: "{}",
    });
    expect((await paystackWebhookPost(req)).status).toBe(400);
  });
});

describe("SECURITY.md — SSRF URL validation", () => {
  it("blocks metadata IP", () => {
    expect(() =>
      assertHttpUrlFetchAllowedSync(
        new URL("http://169.254.169.254/latest/meta-data"),
      ),
    ).toThrow();
  });
});

describe("SECURITY.md — AI billing fail-closed in production", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 402 when Paystack is not configured in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    prismaMock.user.findUnique.mockResolvedValue({
      planTier: "PLUS",
      aiCreditsBalance: 100,
      aiUsageUsed: 0,
      aiUsageMonth: null,
      currentPeriodEnd: new Date(),
    });
    const res = await billingPrecheckResponse("user-1", "generic");
    expect(res?.status).toBe(402);
  });
});

describe("SECURITY.md — session rate limit", () => {
  it("returns 429 when IP cap exceeded", async () => {
    const { assertSessionPostAllowedByIp } = await import(
      "@/lib/upstash-rate-limit"
    );
    vi.mocked(assertSessionPostAllowedByIp).mockResolvedValueOnce({
      ok: false,
      retryAfterSec: 120,
    });
    const req = buildJsonRequest("http://localhost:3000/api/auth/session", {
      method: "POST",
      json: { idToken: "tok" },
    });
    const res = await sessionPost(req);
    expect(res.status).toBe(429);
  });
});
