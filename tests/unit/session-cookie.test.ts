import { describe, expect, it } from "vitest";

import {
  SESSION_COOKIE_MAX_AGE_SEC,
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
} from "@/lib/firebase/session-cookie";

describe("session cookie options", () => {
  it("exports stable cookie name and max age", () => {
    expect(SESSION_COOKIE_NAME).toBe("__gradapply_session");
    expect(SESSION_COOKIE_MAX_AGE_SEC).toBe(60 * 60 * 24 * 5);
  });

  it("builds secure and non-secure options", () => {
    expect(sessionCookieOptions(true)).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_COOKIE_MAX_AGE_SEC,
    });
    expect(sessionCookieOptions(false).secure).toBe(false);
  });
});
