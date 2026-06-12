import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  AiBudgetExceededError,
  billingPrecheckResponse,
  finalizeAiConsumptionForAction,
} from "@/lib/billing-allowance";

import { prismaMock } from "../setup";

vi.mock("@/lib/billing-admin-config", () => ({
  getBillingAdminConfig: vi.fn(async () => ({
    paystackSecretKey: "sk_test",
    creditsPackSize: 50,
    allowance: { FREE: 0, PLUS: 100, PRO: 500 },
    freeSignupCredits: 10,
  })),
}));

describe("billing debit (mocked Prisma)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "test");
  });

  it("billingPrecheckResponse returns 402 when quota exhausted", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      planTier: "FREE",
      aiCreditsBalance: 0,
      aiUsageUsed: 0,
      aiUsageMonth: null,
      currentPeriodEnd: null,
    });
    const res = await billingPrecheckResponse("user-1", "generic");
    expect(res?.status).toBe(402);
    const body = await res!.json();
    expect(body.code).toBe("AI_QUOTA_EXCEEDED");
  });

  it("finalizeAiConsumptionForAction debits FREE credits", async () => {
    prismaMock.user.findUnique
      .mockResolvedValueOnce({
        planTier: "FREE",
        aiCreditsBalance: 5,
        aiUsageUsed: 0,
        aiUsageMonth: null,
        currentPeriodEnd: null,
      })
      .mockResolvedValueOnce({
        planTier: "FREE",
        aiCreditsBalance: 5,
        aiUsageUsed: 0,
        aiUsageMonth: null,
        currentPeriodEnd: null,
      });
    prismaMock.user.updateMany.mockResolvedValue({ count: 1 });
    await finalizeAiConsumptionForAction("user-1", "generic");
    expect(prismaMock.user.updateMany).toHaveBeenCalled();
  });

  it("finalizeAiConsumptionForAction throws when debit fails", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      planTier: "FREE",
      aiCreditsBalance: 0,
      aiUsageUsed: 0,
      aiUsageMonth: null,
      currentPeriodEnd: null,
    });
    prismaMock.user.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      finalizeAiConsumptionForAction("user-1", "generic"),
    ).rejects.toBeInstanceOf(AiBudgetExceededError);
  });
});
