import { describe, expect, it } from "vitest";

import { billingPeriodTokenFromEnd } from "@/lib/billing-allowance";

describe("billingPeriodTokenFromEnd", () => {
  it("returns null for missing or invalid dates", () => {
    expect(billingPeriodTokenFromEnd(null)).toBeNull();
    expect(billingPeriodTokenFromEnd(new Date("invalid"))).toBeNull();
  });

  it("encodes period end as stable token", () => {
    const end = new Date("2026-06-01T00:00:00.000Z");
    expect(billingPeriodTokenFromEnd(end)).toBe(
      "period:2026-06-01T00:00:00.000Z",
    );
  });
});
