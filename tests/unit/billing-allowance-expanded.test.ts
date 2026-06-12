import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  AiBudgetExceededError,
  assertAiBudgetWithinLimitForAction,
  billingPrecheckResponse,
  canUseFreeLifetimeEmailGeneration,
  canUseFreeLifetimeSopPreview,
  finalizeAiConsumptionForAction,
  isAiBudgetError,
  markFreeLifetimeEmailGenerationUsed,
  markFreeLifetimeSopPreviewUsed,
  resetPaidPlanPeriodAllowance,
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

describe("billing allowance (expanded)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "test");
  });

  it("isAiBudgetError identifies quota errors", () => {
    expect(isAiBudgetError(new AiBudgetExceededError("nope"))).toBe(true);
    expect(isAiBudgetError(new Error("other"))).toBe(false);
  });

  it("skips enforcement when Paystack is not configured in non-production", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { getBillingAdminConfig } = await import("@/lib/billing-admin-config");
    vi.mocked(getBillingAdminConfig).mockResolvedValueOnce({
      paystackSecretKey: undefined,
      creditsPackSize: 50,
      allowance: { FREE: 0, PLUS: 100, PRO: 500 },
      freeSignupCredits: 10,
    } as never);
    await expect(
      assertAiBudgetWithinLimitForAction("user-1", "generic"),
    ).resolves.toBeUndefined();
  });

  it("allows PLUS users within plan allowance", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      planTier: "PLUS",
      aiCreditsBalance: 0,
      aiUsageUsed: 10,
      aiUsageMonth: "period:2026-06-01T00:00:00.000Z",
      currentPeriodEnd: new Date("2026-06-01T00:00:00.000Z"),
    });
    await expect(
      assertAiBudgetWithinLimitForAction("user-1", "generic"),
    ).resolves.toBeUndefined();
  });

  it("debits PLUS plan allowance before purchased credits", async () => {
    prismaMock.user.findUnique
      .mockResolvedValueOnce({
        planTier: "PLUS",
        aiCreditsBalance: 20,
        aiUsageUsed: 10,
        aiUsageMonth: "period:2026-06-01T00:00:00.000Z",
        currentPeriodEnd: new Date("2026-06-01T00:00:00.000Z"),
      })
      .mockResolvedValueOnce({
        planTier: "PLUS",
        aiCreditsBalance: 20,
        aiUsageUsed: 10,
        aiUsageMonth: "period:2026-06-01T00:00:00.000Z",
        currentPeriodEnd: new Date("2026-06-01T00:00:00.000Z"),
      });
    prismaMock.user.updateMany.mockResolvedValue({ count: 1 });
    await finalizeAiConsumptionForAction("user-1", "sop_review");
    expect(prismaMock.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { aiUsageUsed: { increment: 3 } },
      }),
    );
  });

  it("resetPaidPlanPeriodAllowance stores period token", async () => {
    const end = new Date("2026-08-01T00:00:00.000Z");
    await resetPaidPlanPeriodAllowance("user-1", end);
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: {
        aiUsageUsed: 0,
        aiUsageMonth: "period:2026-08-01T00:00:00.000Z",
      },
    });
  });

  it("tracks free lifetime email and SOP preview usage", async () => {
    prismaMock.user.findUnique
      .mockResolvedValueOnce({
        planTier: "FREE",
        freeEmailGenUsed: 0,
      })
      .mockResolvedValueOnce({
        planTier: "PLUS",
        freeSopPreviewUsed: 1,
      });
    await expect(canUseFreeLifetimeEmailGeneration("u1")).resolves.toBe(true);
    await expect(canUseFreeLifetimeSopPreview("u2")).resolves.toBe(true);

    await markFreeLifetimeEmailGenerationUsed("u1");
    await markFreeLifetimeSopPreviewUsed("u1");
    expect(prismaMock.user.updateMany).toHaveBeenCalledTimes(2);
  });

  it("billingPrecheckResponse returns null when budget is available", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      planTier: "FREE",
      aiCreditsBalance: 5,
      aiUsageUsed: 0,
      aiUsageMonth: null,
      currentPeriodEnd: null,
    });
    await expect(billingPrecheckResponse("user-1")).resolves.toBeNull();
  });
});
