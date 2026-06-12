import { expect, test } from "@playwright/test";

const stagingUrl = process.env.STAGING_URL?.replace(/\/$/, "");

test.describe("staging billing @staging-only", () => {
  test.skip(!stagingUrl, "STAGING_URL is not set");

  test.use({ baseURL: stagingUrl });

  test("billing status endpoint requires auth", async ({ request }) => {
    const res = await request.get("/api/billing/status");
    expect([401, 403]).toContain(res.status());
  });

  test("health is reachable on staging", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});
