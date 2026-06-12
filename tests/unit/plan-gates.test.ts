import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getUserAccessMode,
  getUserPlanTier,
  requireNonFreeForFeature,
  requirePlusForFeature,
  requireSchoolTrackingCapacity,
  requireWritableAccount,
  schoolTrackingLimitForUser,
} from "@/lib/plan-gates";

import { prismaMock } from "../setup";

describe("plan gates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getUserPlanTier returns tier from database", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ planTier: "PLUS" });
    await expect(getUserPlanTier("u1")).resolves.toBe("PLUS");
  });

  it("getUserAccessMode returns access mode", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ accessMode: "READ_ONLY" });
    await expect(getUserAccessMode("u1")).resolves.toBe("READ_ONLY");
  });

  it("requireWritableAccount blocks read-only accounts", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ accessMode: "READ_ONLY" });
    const res = await requireWritableAccount("u1");
    expect(res?.status).toBe(402);
    const body = await res!.json();
    expect(body.code).toBe("ACCOUNT_READ_ONLY");
  });

  it("requireWritableAccount allows full access", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ accessMode: "FULL" });
    await expect(requireWritableAccount("u1")).resolves.toBeNull();
  });

  it("schoolTrackingLimitForUser enforces FREE limit", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ planTier: "FREE" });
    await expect(schoolTrackingLimitForUser("u1")).resolves.toBe(3);
  });

  it("schoolTrackingLimitForUser allows more for PLUS", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ planTier: "PLUS" });
    await expect(schoolTrackingLimitForUser("u1")).resolves.toBe(25);
  });

  it("requireSchoolTrackingCapacity returns 402 at limit", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ planTier: "FREE" });
    prismaMock.school.count.mockResolvedValue(3);
    const res = await requireSchoolTrackingCapacity("u1");
    expect(res?.status).toBe(402);
    const body = await res!.json();
    expect(body.code).toBe("SCHOOL_LIMIT_REACHED");
  });

  it("requireNonFreeForFeature blocks FREE users", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ planTier: "FREE" });
    const res = await requireNonFreeForFeature("u1", "assistant");
    expect(res?.status).toBe(402);
    const body = await res!.json();
    expect(body.code).toBe("PLAN_UPGRADE_REQUIRED");
  });

  it("requirePlusForFeature blocks non-PLUS users", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ planTier: "FREE" });
    const res = await requirePlusForFeature("u1", "priority_generation");
    expect(res?.status).toBe(402);
    const body = await res!.json();
    expect(body.code).toBe("PLUS_PLAN_REQUIRED");
  });
});
