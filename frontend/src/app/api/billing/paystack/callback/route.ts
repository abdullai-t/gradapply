import { NextResponse } from "next/server";

import { processPaystackReference } from "@/lib/paystack-fulfillment";

/** Paystack redirects here after payment (`reference` or `trxref`). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const ref =
    url.searchParams.get("reference") ?? url.searchParams.get("trxref");

  const origin =
    process.env.AUTH_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    "http://localhost:3000";
  const base = origin.replace(/\/$/, "");

  if (!ref) {
    return NextResponse.redirect(`${base}/settings?billing=error`);
  }

  const result = await processPaystackReference(ref);
  if (!result.applied && !result.duplicate) {
    return NextResponse.redirect(`${base}/settings?billing=error`);
  }

  return NextResponse.redirect(`${base}/settings?billing=success`);
}
