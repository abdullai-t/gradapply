import { describe, expect, it, vi } from "vitest";

import { roleFromFirebaseToken } from "@/lib/firebase/user-sync";

describe("roleFromFirebaseToken", () => {
  it("never elevates role from JWT admin claims", () => {
    expect(
      roleFromFirebaseToken({
        sub: "uid-1",
        admin: true,
        role: "ADMIN",
      }),
    ).toBe("USER");
  });
});
