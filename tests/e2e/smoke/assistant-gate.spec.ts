import { expect, test } from "@playwright/test";

test("FREE user assistant history returns upgrade gate", async ({ request }) => {
  const res = await request.get("/api/chat/history?mode=general");
  expect([401, 402]).toContain(res.status());
  if (res.status() === 402) {
    const body = await res.json();
    expect(body.code).toBe("PLAN_UPGRADE_REQUIRED");
  }
});
