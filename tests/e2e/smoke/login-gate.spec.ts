import { expect, test } from "@playwright/test";

test("unauthenticated /dashboard redirects to /login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
  expect(new URL(page.url()).searchParams.get("callbackUrl")).toBe(
    "/dashboard",
  );
});
