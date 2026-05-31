import { Ratelimit } from "@upstash/ratelimit";

import { getUpstashRedis } from "@/lib/upstash-rate-limit";

let guestCommentRatelimit: Ratelimit | undefined;

function getGuestCommentRatelimit(): Ratelimit | null {
  const redis = getUpstashRedis();
  if (!redis) return null;
  if (!guestCommentRatelimit) {
    guestCommentRatelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(30, "1 h"),
      prefix: "gradapply:collab:guest-comment",
    });
  }
  return guestCommentRatelimit;
}

const memoryBuckets = new Map<string, { count: number; resetAt: number }>();

export async function assertGuestCommentAllowed(
  sessionId: string,
): Promise<{ ok: true } | { ok: false; retryAfterSec: number }> {
  const rl = getGuestCommentRatelimit();
  if (rl) {
    const result = await rl.limit(sessionId);
    if (!result.success) {
      return {
        ok: false,
        retryAfterSec: Math.max(
          1,
          Math.ceil((result.reset - Date.now()) / 1000),
        ),
      };
    }
    return { ok: true };
  }

  const now = Date.now();
  const bucket = memoryBuckets.get(sessionId);
  if (!bucket || bucket.resetAt < now) {
    memoryBuckets.set(sessionId, { count: 1, resetAt: now + 3_600_000 });
    return { ok: true };
  }
  if (bucket.count >= 30) {
    return {
      ok: false,
      retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000),
    };
  }
  bucket.count += 1;
  return { ok: true };
}
