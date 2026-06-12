import { beforeEach, describe, expect, it, vi } from "vitest";

import { grantCreditsPackToUser } from "@/lib/billing-credits";

import { prismaMock } from "../setup";

vi.mock("@/lib/billing-admin-config", () => ({
  getBillingAdminConfig: vi.fn(async () => ({
    creditsPackSize: 50,
  })),
}));

describe("grantCreditsPackToUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.user.update.mockResolvedValue({});
  });

  it("uses explicit pack size when provided", async () => {
    await grantCreditsPackToUser("user-1", 25);
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { aiCreditsBalance: { increment: 25 } },
    });
  });

  it("falls back to configured default pack size", async () => {
    await grantCreditsPackToUser("user-1");
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { aiCreditsBalance: { increment: 50 } },
    });
  });
});
