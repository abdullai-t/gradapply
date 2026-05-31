import { randomBytes } from "node:crypto";

import { appOrigin } from "@/lib/app-origin";

import { driveJson } from "./client";

type WatchResponse = {
  id: string;
  resourceId: string;
  expiration: string;
};

export function webhookAddress(): string {
  return `${appOrigin()}/api/webhooks/google-drive`;
}

export function newWatchChannelToken(): string {
  return randomBytes(24).toString("base64url");
}

export async function startFileWatch(opts: {
  userId: string;
  fileId: string;
  channelToken: string;
}): Promise<{
  channelId: string;
  resourceId: string;
  expiresAt: Date;
}> {
  const channelId = `ga-${randomBytes(12).toString("hex")}`;
  const body = {
    id: channelId,
    type: "web_hook",
    address: webhookAddress(),
    token: opts.channelToken,
    expiration: String(Date.now() + 6 * 24 * 60 * 60 * 1000),
  };

  const res = await driveJson<WatchResponse>(
    opts.userId,
    `/files/${encodeURIComponent(opts.fileId)}/watch`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );

  return {
    channelId: res.id,
    resourceId: res.resourceId,
    expiresAt: new Date(Number(res.expiration)),
  };
}

export async function stopChannel(opts: {
  userId: string;
  channelId: string;
  resourceId: string;
}): Promise<void> {
  try {
    await driveJson(opts.userId, "/channels/stop", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: opts.channelId,
        resourceId: opts.resourceId,
      }),
    });
  } catch {
    // Channel may already be expired
  }
}
