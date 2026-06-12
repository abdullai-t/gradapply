import { expect, test } from "@playwright/test";

const stagingUrl = process.env.STAGING_URL?.replace(/\/$/, "");

test.describe("staging @staging-only", () => {
  test.skip(!stagingUrl, "STAGING_URL is not set");

  test.use({ baseURL: stagingUrl });

  test("staging login page loads", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("body")).toBeVisible();
  });
});
