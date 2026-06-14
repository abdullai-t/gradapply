import { prisma } from "@/lib/prisma";
import { sendTestPushToUser } from "@/lib/push/send-test";

import { bad, ok } from "../_responses";
import { withAuth } from "../_with-auth";

import { registerPushTokenSchema, unregisterPushTokenSchema } from "./schemas";

export const registerPushToken = withAuth(async (req, { userId }) => {
  const json = await req.json().catch(() => null);
  const parsed = registerPushTokenSchema.safeParse(json);
  if (!parsed.success) return bad(parsed.error.flatten());

  const userAgent = req.headers.get("user-agent")?.slice(0, 512) ?? null;
  const { token, platform } = parsed.data;

  const row = await prisma.pushToken.upsert({
    where: { token },
    create: {
      userId,
      token,
      platform,
      userAgent,
    },
    update: {
      userId,
      platform,
      userAgent,
      lastSeenAt: new Date(),
    },
  });

  return ok({ id: row.id, registered: true });
});

export const unregisterPushToken = withAuth(async (req, { userId }) => {
  const json = await req.json().catch(() => ({}));
  const parsed = unregisterPushTokenSchema.safeParse(json);
  if (!parsed.success) return bad(parsed.error.flatten());

  if (parsed.data.token) {
    await prisma.pushToken.deleteMany({
      where: { userId, token: parsed.data.token },
    });
  } else {
    await prisma.pushToken.deleteMany({ where: { userId } });
  }

  return ok({ unregistered: true });
});

export const sendTestPush = withAuth(async (_req, { userId }) => {
  const result = await sendTestPushToUser(userId);

  if (result.status === "skipped") {
    if (result.reason === "no_push_tokens") {
      return bad(
        "No push token registered. Enable push on this browser first, then try again.",
        400,
      );
    }
    if (result.reason === "fcm_not_configured") {
      return bad(
        "FCM is not configured on the server (FIREBASE_SERVICE_ACCOUNT_JSON).",
        503,
      );
    }
    return bad(result.reason, 400);
  }

  if (result.status === "failed") {
    return bad(result.error, 502);
  }

  return ok({
    sent: true,
    delivered: result.delivered,
    failed: result.failed,
  });
});
