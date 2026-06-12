import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AiBudgetExceededError,
  finalizeAiConsumptionForAction,
} from "@/lib/billing-allowance";

import {
  disconnectTestDatabase,
  getTestPrisma,
  isDbTestEnabled,
  resetTestDatabase,
} from "../helpers/prisma-test-db";

const describeDb = isDbTestEnabled() ? describe : describe.skip;

vi.mock("@/lib/billing-admin-config", () => ({
  getBillingAdminConfig: vi.fn(async () => ({
    paystackSecretKey: "sk_test",
    creditsPackSize: 50,
    allowance: { FREE: 0, PLUS: 100, PRO: 500 },
    freeSignupCredits: 10,
  })),
}));

describeDb("AI debit concurrency (real Postgres)", () => {
  const userId = "debit-race-user";

  beforeEach(async () => {
    await resetTestDatabase();
    const prisma = getTestPrisma();
    await prisma.user.create({
      data: {
        id: userId,
        email: "debit-race@test.local",
        planTier: "FREE",
        aiCreditsBalance: 1,
      },
    });
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  it("only one concurrent debit succeeds at quota boundary", async () => {
    const results = await Promise.allSettled([
      finalizeAiConsumptionForAction(userId, "generic"),
      finalizeAiConsumptionForAction(userId, "generic"),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(
      (rejected[0] as PromiseRejectedResult).reason,
    ).toBeInstanceOf(AiBudgetExceededError);

    const prisma = getTestPrisma();
    const user = await prisma.user.findUnique({ where: { id: userId } });
    expect(user?.aiCreditsBalance).toBe(0);
  });
});
