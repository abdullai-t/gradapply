import { expect, test } from "@playwright/test";

/**
 * PLUS chat with mocked LLM is covered in Vitest handler tests.
 * Smoke: authenticated PLUS user can reach assistant page without 500.
 */
test("PLUS fixture session reaches assistant shell", async ({
  page,
  context,
}) => {
  const plusUserId = process.env.E2E_PLUS_USER_ID ?? "e2e-plus-user";
  const { setE2eSessionCookie } = await import("../helpers/auth");
  await setE2eSessionCookie(context, plusUserId, "plus-e2e@test.local");

  const res = await page.goto("/assistant");
  expect(res?.status()).toBeLessThan(500);
});
