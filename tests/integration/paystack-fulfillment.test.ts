import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  processPaystackReference,
  upsertPaystackSubscriptionUser,
} from "@/lib/paystack-fulfillment";

import { prismaMock } from "../setup";

const { billingAdminConfig } = vi.hoisted(() => ({
  billingAdminConfig: {
    paystackSecretKey: "sk_test",
    creditsPackSize: 50,
    allowance: { FREE: 0, PLUS: 500, PRO: 2000 },
    freeSignupCredits: 10,
    paystackPlanCodePlus: "PLN_plus_test",
    paystackPlanCodePro: "PLN_pro_test",
  },
}));

vi.mock("@/lib/billing-admin-config", () => ({
  getBillingAdminConfig: vi.fn(async () => billingAdminConfig),
}));

vi.mock("@/lib/paystack-api", () => ({
  paystackVerifyTransaction: vi.fn(),
}));

vi.mock("@/lib/billing-credits", () => ({
  grantCreditsPackToUser: vi.fn(),
}));

vi.mock("@/lib/notifications/send", () => ({
  notifyInBackground: vi.fn(),
  sendCreditsPurchasedEmail: vi.fn(),
  sendPlanSubscriptionEmail: vi.fn(),
}));

vi.mock("@/lib/posthog-server", () => ({
  getPostHogClient: vi.fn(() => null),
}));

import { grantCreditsPackToUser } from "@/lib/billing-credits";
import { paystackVerifyTransaction } from "@/lib/paystack-api";

describe("processPaystackReference", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.paystackEventLog.create.mockResolvedValue({ reference: "ref-1" });
    prismaMock.billingPayment.create.mockResolvedValue({});
    prismaMock.user.update.mockResolvedValue({});
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "u@test.local",
      name: "User",
      aiCreditsBalance: 10,
      currentPeriodEnd: null,
      profile: { timezone: null },
    });
  });

  it("no-ops when transaction is not successful", async () => {
    vi.mocked(paystackVerifyTransaction).mockResolvedValue({
      status: "failed",
      metadata: {},
    });
    const result = await processPaystackReference("ref-fail");
    expect(result).toEqual({ duplicate: false, applied: false });
    expect(prismaMock.paystackEventLog.create).not.toHaveBeenCalled();
  });

  it("fulfills credits pack once", async () => {
    vi.mocked(paystackVerifyTransaction).mockResolvedValue({
      status: "success",
      amount: 1000,
      currency: "GHS",
      metadata: {
        userId: "user-1",
        checkoutKind: "credits_pack",
        creditsAmount: "25",
      },
    });
    const result = await processPaystackReference("ref-credits");
    expect(result.duplicate).toBe(false);
    expect(result.applied).toBe(true);
    expect(grantCreditsPackToUser).toHaveBeenCalledWith("user-1", 25);
  });

  it("returns duplicate when reference already claimed", async () => {
    vi.mocked(paystackVerifyTransaction).mockResolvedValue({
      status: "success",
      metadata: { userId: "user-1", checkoutKind: "credits_pack" },
    });
    prismaMock.paystackEventLog.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("dup", {
        code: "P2002",
        clientVersion: "test",
      }),
    );
    const result = await processPaystackReference("ref-dup");
    expect(result).toEqual({ duplicate: true, applied: false });
    expect(grantCreditsPackToUser).not.toHaveBeenCalled();
  });

  it("fulfills plan purchase for PLUS tier", async () => {
    vi.mocked(paystackVerifyTransaction).mockResolvedValue({
      status: "success",
      amount: 20000,
      currency: "GHS",
      paidAt: "2026-01-15T12:00:00.000Z",
      metadata: {
        userId: "user-1",
        checkoutKind: "plan_purchase",
        tier: "plus",
      },
      customer: { id: 77 },
    });
    const result = await processPaystackReference("ref-plan");
    expect(result).toEqual({
      duplicate: false,
      applied: true,
      kind: "subscription",
    });
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user-1" },
        data: expect.objectContaining({ planTier: "PLUS", accessMode: "FULL" }),
      }),
    );
    expect(prismaMock.billingPayment.create).toHaveBeenCalled();
  });

  it("records addon service purchases", async () => {
    vi.mocked(paystackVerifyTransaction).mockResolvedValue({
      status: "success",
      metadata: {
        userId: "user-1",
        checkoutKind: "cv_deep_review",
      },
      customer: { id: 12 },
    });
    const result = await processPaystackReference("ref-addon");
    expect(result.applied).toBe(true);
    expect(prismaMock.billingPayment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ kind: "CV_DEEP_REVIEW" }),
      }),
    );
  });

  it("fulfills subscription renewal via Paystack customer + plan code", async () => {
    vi.mocked(paystackVerifyTransaction).mockResolvedValue({
      status: "success",
      amount: 15000,
      currency: "GHS",
      customer: { id: 55 },
      plan: { plan_code: "PLN_plus_test" },
    });
    prismaMock.user.findFirst.mockResolvedValue({ id: "user-1" });
    const result = await processPaystackReference("ref-sub");
    expect(result).toEqual({
      duplicate: false,
      applied: true,
      kind: "subscription",
    });
    expect(prismaMock.user.update).toHaveBeenCalled();
  });
});

describe("upsertPaystackSubscriptionUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.user.update.mockResolvedValue({});
  });

  it("updates subscription fields and resets allowance", async () => {
    await upsertPaystackSubscriptionUser({
      userId: "user-1",
      customerId: 88,
      tier: "PLUS",
      sub: {
        subscription_code: "SUB_88",
        status: "active",
        next_payment_date: "2026-09-01T00:00:00.000Z",
      },
    });
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user-1" },
        data: expect.objectContaining({
          planTier: "PLUS",
          paystackSubscriptionCode: "SUB_88",
        }),
      }),
    );
  });
});
