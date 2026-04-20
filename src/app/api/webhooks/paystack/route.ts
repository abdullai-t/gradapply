import { NextResponse } from "next/server";

import { processPaystackReference } from "@/lib/paystack-fulfillment";
import { verifyPaystackWebhookSignature } from "@/lib/paystack-api";

export async function POST(req: Request) {
  const raw = await req.text();
  const sig = req.headers.get("x-paystack-signature");
  if (!verifyPaystackWebhookSignature(raw, sig)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let body: { event?: string; data?: { reference?: string } };
  try {
    body = JSON.parse(raw) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const ref = body.data?.reference;
  if (
    body.event === "charge.success" &&
    typeof ref === "string" &&
    ref.length > 0
  ) {
    await processPaystackReference(ref);
  }

  return NextResponse.json({ received: true });
}
