import { Liveblocks } from "@liveblocks/node";

import { auth } from "@/auth";
import { collabGuestTokenFromRequest } from "@/lib/collab-tokens";
import { isTrustedMutationOrigin } from "@/lib/request-origin";
import { requireCollaborationFeature } from "@/lib/collaboration-gates";
import { getDb } from "@/lib/prisma";
import { bad, forbidden } from "@/server/_responses";

import { canEditLive, resolveSessionAccess } from "./auth";

function liveblocksClient(): Liveblocks | null {
  const secret = process.env.LIVEBLOCKS_SECRET_KEY?.trim();
  if (!secret) return null;
  return new Liveblocks({ secret });
}

export async function liveblocksAuth(req: Request): Promise<Response> {
  if (!isTrustedMutationOrigin(req)) {
    return forbidden("Untrusted origin");
  }

  const gate = await requireCollaborationFeature();
  if (gate) return gate;

  const lb = liveblocksClient();
  if (!lb) {
    return bad("Live collaboration is not configured on this server");
  }

  const json = await req.json().catch(() => null);
  const room =
    json && typeof json === "object" && "room" in json
      ? String((json as { room: unknown }).room)
      : "";
  if (!room.startsWith("collab:")) {
    return bad("Invalid room");
  }

  const sessionId = room.slice("collab:".length);
  const sessionAuth = await auth();
  const userId = sessionAuth?.user?.id ?? null;

  let access = await resolveSessionAccess(req, sessionId, userId);
  if (!access) {
    const guestToken = collabGuestTokenFromRequest(req);
    if (guestToken) {
      access = await resolveSessionAccess(req, sessionId, null);
    }
  }

  if (!access) return forbidden("No access to this review session");
  if (!access.session.liveEnabled) {
    return bad("Live session is not active");
  }

  let lbUserId: string;
  let name: string;
  let readonly: boolean;

  if (access.kind === "guest") {
    lbUserId = `guest:${access.invite.id}`;
    name = access.guestLabel?.trim() || "Guest reviewer";
    readonly = true;
  } else {
    const user = await getDb().user.findUnique({
      where: { id: access.userId },
      select: { name: true, email: true },
    });
    lbUserId = access.userId;
    name = user?.name?.trim() || user?.email?.trim() || "Scholar";
    readonly = !canEditLive(access);
  }

  const session = lb.prepareSession(lbUserId, {
    userInfo: { name, readonly: String(readonly) },
  });

  if (readonly) {
    session.allow(room, session.READ_ACCESS);
  } else {
    session.allow(room, session.FULL_ACCESS);
  }

  const { status, body } = await session.authorize();
  return new Response(body, { status });
}
