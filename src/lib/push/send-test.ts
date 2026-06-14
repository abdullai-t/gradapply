import { appOrigin } from "@/lib/app-origin";
import { isFcmConfigured, sendFcmMessage } from "@/lib/push/fcm-client";
import { pruneStalePushTokens } from "@/lib/push/prune-stale-tokens";
import { prisma } from "@/lib/prisma";

export type SendTestPushResult =
  | { status: "sent"; delivered: number; failed: number }
  | { status: "skipped"; reason: string }
  | { status: "failed"; error: string };

export async function sendTestPushToUser(userId: string): Promise<SendTestPushResult> {
  if (!isFcmConfigured()) {
    return { status: "skipped", reason: "fcm_not_configured" };
  }

  const tokens = await prisma.pushToken.findMany({
    where: { userId },
    select: { token: true },
  });

  if (tokens.length === 0) {
    return { status: "skipped", reason: "no_push_tokens" };
  }

  const origin = appOrigin();
  const url = `${origin}/schools`;
  const title = "GradApply test notification";
  const body = "Push is working. You will get deadline and reminder alerts here.";
  const tag = `gradapply-test:${Date.now()}`;

  let delivered = 0;
  let failed = 0;
  let lastError: string | undefined;
  const staleTokens: string[] = [];

  for (const row of tokens) {
    const result = await sendFcmMessage({
      token: row.token,
      title,
      body,
      data: {
        type: "TEST",
        url,
        tag,
      },
    });

    if (result.status === "sent") {
      delivered += 1;
    } else {
      failed += 1;
      lastError = result.error;
      if (result.staleToken) staleTokens.push(row.token);
    }
  }

  if (staleTokens.length > 0) {
    await pruneStalePushTokens(staleTokens);
  }

  if (delivered === 0) {
    return {
      status: "failed",
      error: lastError ?? "push_delivery_failed",
    };
  }

  return { status: "sent", delivered, failed };
}
