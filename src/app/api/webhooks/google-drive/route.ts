import { NextResponse } from "next/server";

import { schedulePullByFileId } from "@/lib/google-docs/push-hook";
import { getDb } from "@/lib/prisma";
import { getClientIpFromRequest, getUpstashRedis } from "@/lib/upstash-rate-limit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const redis = getUpstashRedis();
  if (redis) {
    const ip = getClientIpFromRequest(req);
    const key = `gdocs:webhook:${ip}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, 60);
    if (count > 120) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }
  }

  const channelId = req.headers.get("x-goog-channel-id");
  const token = req.headers.get("x-goog-channel-token");
  const resourceState = req.headers.get("x-goog-resource-state");

  if (!channelId || !token) {
    return NextResponse.json({ ok: true });
  }

  if (resourceState === "sync") {
    return NextResponse.json({ ok: true });
  }

  const db = getDb();
  const link = await db.googleDocLink.findFirst({
    where: { watchChannelId: channelId, watchChannelToken: token },
  });

  if (!link) {
    return NextResponse.json({ ok: true });
  }

  schedulePullByFileId(link.googleFileId);
  return NextResponse.json({ ok: true });
}
