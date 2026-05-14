import { NextResponse } from "next/server";

import { getAuthSetupStatus } from "@/auth";
import { appOrigin } from "@/lib/app-origin";
import {
  getMailTransportMode,
  isMailConfigured,
  mailFromAddress,
  verifyMailTransport,
} from "@/lib/mail";

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
  const url = new URL(req.url);
  const runVerify = url.searchParams.get("verify") === "1";

  const emailBase = {
    configured: isMailConfigured(),
    mode: getMailTransportMode(),
    from: mailFromAddress(),
    magicLinkProviderEnabled: setup.hasEmail,
  };

  const email =
    runVerify && isMailConfigured()
      ? { ...emailBase, ...(await verifyMailTransport()) }
      : emailBase;

  return NextResponse.json(
    {
      ok: true,
      auth: {
        hasSecret: setup.hasSecret,
        hasGoogle: setup.hasGoogle,
        hasPasswordLogin: setup.hasPasswordLogin,
        hasEmail: setup.hasEmail,
      },
      email,
      origin: {
        configured: configuredOrigin,
        derivedFromRequest: derivedOrigin || null,
      },
      google: {
        expectedRedirectUri: `${configuredOrigin}/api/auth/callback/google`,
      },
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}
