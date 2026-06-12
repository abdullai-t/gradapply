import { createHmac } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/webhooks/paystack/route";

vi.mock("@/lib/billing-admin-config", () => ({
  getBillingAdminConfig: vi.fn(async () => ({
    paystackSecretKey: "sk_test_webhook",
    paystackWebhookSecret: "whsec",
    creditsPackSize: 50,
    allowance: { FREE: 0, PLUS: 500, PRO: 2000 },
    freeSignupCredits: 10,
  })),
}));

vi.mock("@/lib/paystack-fulfillment", () => ({
  processPaystackReference: vi.fn(async () => ({
    duplicate: false,
    applied: true,
  })),
}));

import { processPaystackReference } from "@/lib/paystack-fulfillment";

function sign(body: string, secret: string): string {
  return createHmac("sha512", secret).update(body).digest("hex");
}

describe("Paystack webhook", () => {
  it("rejects invalid HMAC", async () => {
    const body = JSON.stringify({ event: "charge.success", data: { reference: "r1" } });
    const req = new Request("http://localhost/api/webhooks/paystack", {
      method: "POST",
      body,
      headers: { "x-paystack-signature": "bad" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(processPaystackReference).not.toHaveBeenCalled();
  });

  it("fulfills on valid charge.success", async () => {
    const body = JSON.stringify({
      event: "charge.success",
      data: { reference: "ref-ok" },
    });
    const sig = sign(body, "sk_test_webhook");
    const req = new Request("http://localhost/api/webhooks/paystack", {
      method: "POST",
      body,
      headers: { "x-paystack-signature": sig },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(processPaystackReference).toHaveBeenCalledWith("ref-ok");
  });
});
