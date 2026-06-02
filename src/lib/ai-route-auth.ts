import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { isTrustedMutationOrigin } from "@/lib/request-origin";

/** CSRF + session guard for `/api/ai/*` POST handlers. */
export async function requireAuthedAiMutation(
  req: Request,
): Promise<{ userId: string } | Response> {
  if (!isTrustedMutationOrigin(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return { userId: session.user.id };
}
