import { describe, expect, it } from "vitest";

import {
  AUTH_CONTINUE_PATH,
  isSafeAuthRedirectPath,
} from "@/lib/auth-redirect";

describe("isSafeAuthRedirectPath", () => {
  it("allows relative in-app paths", () => {
    expect(isSafeAuthRedirectPath("/dashboard")).toBe(true);
    expect(isSafeAuthRedirectPath("/settings/billing")).toBe(true);
    expect(isSafeAuthRedirectPath(AUTH_CONTINUE_PATH)).toBe(true);
  });

  it("rejects protocol-relative and off-site patterns", () => {
    expect(isSafeAuthRedirectPath("//evil.com")).toBe(false);
    expect(isSafeAuthRedirectPath("https://evil.com")).toBe(false);
    expect(isSafeAuthRedirectPath("/path\\@evil")).toBe(false);
    expect(isSafeAuthRedirectPath("/login?next=//evil")).toBe(true);
  });

  it("rejects backslashes and @ in path", () => {
    expect(isSafeAuthRedirectPath("/foo\\bar")).toBe(false);
    expect(isSafeAuthRedirectPath("/user@host")).toBe(false);
  });

  it("rejects paths not starting with /", () => {
    expect(isSafeAuthRedirectPath("dashboard")).toBe(false);
    expect(isSafeAuthRedirectPath("")).toBe(false);
  });
});
