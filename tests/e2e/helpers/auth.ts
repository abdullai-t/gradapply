import type { BrowserContext } from "@playwright/test";

import { e2eSessionToken } from "../../helpers/auth-headers";

const SESSION_COOKIE_NAME = "__gradapply_session";

export async function setE2eSessionCookie(
  context: BrowserContext,
  userId: string,
  email = "e2e@test.local",
): Promise<void> {
  const baseURL =
    process.env.PLAYWRIGHT_BASE_URL?.replace(/\/$/, "") ??
    "http://localhost:3000";
  const token = e2eSessionToken(userId, email);
  await context.addCookies([
    {
      name: SESSION_COOKIE_NAME,
      value: token,
      url: baseURL,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}
