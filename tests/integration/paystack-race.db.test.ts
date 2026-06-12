import { Prisma } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { processPaystackReference } from "@/lib/paystack-fulfillment";

import {
  disconnectTestDatabase,
  getTestPrisma,
  isDbTestEnabled,
  resetTestDatabase,
  seedMinimalUsers,
} from "../helpers/prisma-test-db";

const describeDb = isDbTestEnabled() ? describe : describe.skip;

vi.mock("@/lib/billing-admin-config", () => ({
  getBillingAdminConfig: vi.fn(async () => ({
    paystackSecretKey: "sk_test",
    creditsPackSize: 50,
    allowance: { FREE: 0, PLUS: 500, PRO: 2000 },
    freeSignupCredits: 10,
  })),
}));

vi.mock("@/lib/paystack-api", () => ({
  paystackVerifyTransaction: vi.fn(),
}));

vi.mock("@/lib/notifications/send", () => ({
  notifyInBackground: vi.fn(),
  sendCreditsPurchasedEmail: vi.fn(),
  sendPlanSubscriptionEmail: vi.fn(),
}));

vi.mock("@/lib/posthog-server", () => ({
  getPostHogClient: vi.fn(() => null),
}));

import { paystackVerifyTransaction } from "@/lib/paystack-api";

describeDb("Paystack reference idempotency (real Postgres)", () => {
  let freeUserId: string;

  beforeEach(async () => {
    await resetTestDatabase();
    const users = await seedMinimalUsers();
    freeUserId = users.freeUserId;
    vi.mocked(paystackVerifyTransaction).mockResolvedValue({
      status: "success",
      amount: 1000,
      currency: "GHS",
      metadata: {
        userId: freeUserId,
        checkoutKind: "credits_pack",
        creditsAmount: "10",
      },
    });
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  it("concurrent fulfillments grant credits only once", async () => {
    const reference = "race-ref-001";
    const [a, b] = await Promise.all([
      processPaystackReference(reference),
      processPaystackReference(reference),
    ]);

    const winners = [a, b].filter((r) => r.applied);
    const dupes = [a, b].filter((r) => r.duplicate);
    expect(winners).toHaveLength(1);
    expect(dupes).toHaveLength(1);

    const prisma = getTestPrisma();
    const logs = await prisma.paystackEventLog.findMany({
      where: { reference },
    });
    expect(logs).toHaveLength(1);

    const user = await prisma.user.findUnique({ where: { id: freeUserId } });
    expect(user?.aiCreditsBalance).toBe(15);
  });

  it("duplicate insert throws P2002 at DB layer", async () => {
    const prisma = getTestPrisma();
    await prisma.paystackEventLog.create({ data: { reference: "dup-ref" } });
    await expect(
      prisma.paystackEventLog.create({ data: { reference: "dup-ref" } }),
    ).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
  });
});
