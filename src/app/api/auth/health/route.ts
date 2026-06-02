import { NextResponse } from "next/server";

import { getAuthSetupStatus } from "@/auth";
import { appOrigin } from "@/lib/app-origin";
import { isFirebaseConfigured } from "@/lib/firebase/config";

export const runtime = "nodejs";

function requestOrigin(req: Request): string {
  const forwardedProto =
    req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
  const forwardedHost =
    req.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    req.headers.get("host")?.trim() ||
    "";
  if (!forwardedHost) return "";
  return `${forwardedProto}://${forwardedHost}`;
}

export async function GET(req: Request) {
  const setup = getAuthSetupStatus();
  const configuredOrigin = appOrigin();
  const derivedOrigin = requestOrigin(req);

  return NextResponse.json(
    {
      ok: true,
      auth: {
        hasFirebase: setup.hasFirebase,
        hasGoogle: setup.hasGoogle,
        hasEmailMagicLink: setup.hasEmail,
      },
      origin: {
        configured: configuredOrigin,
        derivedFromRequest: derivedOrigin || null,
      },
      firebase: {
        configured: isFirebaseConfigured(),
        emailLinkFinishUrl: `${configuredOrigin}/auth/email-link`,
      },
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}
