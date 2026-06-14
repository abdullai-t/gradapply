import { describe, expect, it } from "vitest";

import {
  buildFcmMessageBody,
  isFcmConfigured,
} from "@/lib/push/fcm-client";

describe("buildFcmMessageBody", () => {
  it("includes notification, data, and webpush link", () => {
    const body = buildFcmMessageBody({
      token: "abc123",
      title: "Deadline soon",
      body: "Stanford · Jun 2",
      data: {
        schoolId: "sch-1",
        url: "https://app.example/schools/sch-1",
        type: "DEADLINE_30D",
      },
    });

    expect(body.message.token).toBe("abc123");
    expect(body.message.notification?.title).toBe("Deadline soon");
    expect(body.message.data?.schoolId).toBe("sch-1");
    expect(body.message.webpush?.fcmOptions?.link).toBe(
      "https://app.example/schools/sch-1",
    );
  });
});

describe("isFcmConfigured", () => {
  it("returns false without service account env", () => {
    const prev = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    delete process.env.FIREBASE_PROJECT_ID;
    delete process.env.FIREBASE_CLIENT_EMAIL;
    delete process.env.FIREBASE_PRIVATE_KEY;
    expect(isFcmConfigured()).toBe(false);
    if (prev) process.env.FIREBASE_SERVICE_ACCOUNT_JSON = prev;
  });
});
