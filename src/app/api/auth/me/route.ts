import { NextResponse } from "next/server";

import { getCurrentUserRole } from "@/lib/admin-auth";
import { getSessionTokenFromCookies } from "@/lib/firebase/server-session";
import { ensureAppUserFromFirebaseToken } from "@/lib/firebase/user-sync";
import { verifyFirebaseSessionCookieEdge } from "@/lib/firebase/verify-token-edge";
import { log } from "@/lib/logger";

export const runtime = "nodejs";

/**
 * Provisions / syncs the Postgres user for the current Firebase session and
 * returns app profile (role, billing row, etc.).
 */
export async function GET(req: Request) {
  const token = await getSessionTokenFromCookies();
  if (!token) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const decoded = await verifyFirebaseSessionCookieEdge(token);
  if (!decoded?.sub) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  const isAdminProbe =
    new URL(req.url).searchParams.get("admin") === "1" ||
    req.headers.get("x-gradapply-admin-login") === "1";

  try {
    const user = await ensureAppUserFromFirebaseToken(decoded);

    if (isAdminProbe) {
      const role = await getCurrentUserRole(user.id);
      if (role !== "ADMIN" && role !== "SUPERADMIN") {
        return NextResponse.json(
          { error: "Admin access required" },
          { status: 403 },
        );
      }
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        role: user.role,
      },
    });
  } catch (error) {
    log.error("auth.me.provision_failed", {
      uid: decoded.sub,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      {
        error:
          "Signed in with Firebase, but we could not load your account. Check database connectivity and try again.",
      },
      { status: 503 },
    );
  }
}
