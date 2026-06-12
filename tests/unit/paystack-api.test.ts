import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  computePaystackSignature,
  paystackCreateCustomer,
  paystackCreateSubscription,
  paystackCurrency,
  paystackInitializeTransaction,
  paystackSecretKey,
  paystackVerifyTransaction,
  verifyPaystackWebhookSignature,
} from "@/lib/paystack-api";

describe("paystack-api helpers", () => {
  beforeEach(() => {
    vi.stubEnv("PAYSTACK_SECRET_KEY", "sk_test_secret");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("reads secret key and currency from env", () => {
    expect(paystackSecretKey()).toBe("sk_test_secret");
    vi.stubEnv("PAYSTACK_CURRENCY", "ngn");
    expect(paystackCurrency()).toBe("NGN");
  });

  it("computes and verifies webhook signatures", () => {
    const body = '{"event":"charge.success"}';
    const sig = computePaystackSignature(body, "sk_test_secret");
    expect(verifyPaystackWebhookSignature(body, sig, "sk_test_secret")).toBe(
      true,
    );
    expect(verifyPaystackWebhookSignature(body, "bad", "sk_test_secret")).toBe(
      false,
    );
    expect(verifyPaystackWebhookSignature(body, null)).toBe(false);
  });

  it("initializes a transaction", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          status: true,
          message: "ok",
          data: {
            authorization_url: "https://paystack.com/pay",
            reference: "ref-1",
          },
        }),
      })),
    );

    const data = await paystackInitializeTransaction({
      email: "u@test.local",
      amountMinor: 1000,
      currency: "GHS",
      metadata: { userId: "u1" },
      callbackUrl: "http://localhost/callback",
    });
    expect(data.authorization_url).toContain("paystack.com");
  });

  it("verifies a successful transaction", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          status: true,
          data: {
            status: "success",
            reference: "ref-2",
            paid_at: "2026-01-01T00:00:00.000Z",
            amount: 5000,
            currency: "GHS",
            metadata: { userId: "u1" },
            customer: { id: 42, email: "u@test.local" },
            plan: { plan_code: "PLN_plus" },
          },
        }),
      })),
    );

    const tx = await paystackVerifyTransaction("ref-2");
    expect(tx?.status).toBe("success");
    expect(tx?.customer?.id).toBe(42);
    expect(tx?.plan?.plan_code).toBe("PLN_plus");
  });

  it("returns null when verify fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        json: async () => ({ status: false, message: "not found" }),
      })),
    );
    await expect(paystackVerifyTransaction("missing")).resolves.toBeNull();
  });

  it("creates customers and subscriptions", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: true,
          data: { id: 99, customer_code: "CUS_1", email: "u@test.local" },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: true,
          data: {
            subscription_code: "SUB_1",
            status: "active",
            next_payment_date: "2026-07-01T00:00:00.000Z",
          },
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const customer = await paystackCreateCustomer({ email: "u@test.local" });
    expect(customer.id).toBe(99);

    const sub = await paystackCreateSubscription({
      customerId: 99,
      planCode: "PLN_plus",
    });
    expect(sub.subscription_code).toBe("SUB_1");
  });

  it("throws when secret key is missing", async () => {
    vi.unstubAllEnvs();
    await expect(
      paystackInitializeTransaction({
        email: "u@test.local",
        amountMinor: 1,
        currency: "GHS",
        metadata: {},
        callbackUrl: "http://localhost",
      }),
    ).rejects.toThrow(/PAYSTACK_SECRET_KEY/);
  });
});
