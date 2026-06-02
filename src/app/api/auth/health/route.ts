import { NextResponse } from "next/server";

import { getAuthSetupStatus } from "@/auth";
import { appOrigin } from "@/lib/app-origin";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { requestPublicOrigin } from "@/lib/request-origin";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const setup = getAuthSetupStatus();
  const configuredOrigin = appOrigin();
  const derivedOrigin = requestPublicOrigin(req);

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
