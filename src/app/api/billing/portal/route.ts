import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getBillingAdminConfig } from "@/lib/billing-admin-config";
import { prisma } from "@/lib/prisma";
import { isTrustedMutationOrigin } from "@/lib/request-origin";
import { getStripe } from "@/lib/stripe-server";

export async function POST(req: Request) {
  if (!isTrustedMutationOrigin(req)) {
    return NextResponse.json({ error: "Untrusted origin" }, { status: 403 });
  }
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cfg = await getBillingAdminConfig();
  if (!cfg.stripeSecretKey && !cfg.paystackSecretKey) {
    return NextResponse.json(
      { error: "Billing is not configured on this server." },
      { status: 503 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { stripeCustomerId: true },
  });

  if (!user?.stripeCustomerId) {
    return NextResponse.json(
      { error: "No Stripe customer on file. Subscribe or buy credits first." },
      { status: 400 },
    );
  }

  const origin =
    process.env.AUTH_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    "http://localhost:3000";

  if (!cfg.stripeSecretKey) {
    return NextResponse.json(
      { error: "Stripe portal is not configured on this server." },
      { status: 503 },
    );
  }

  const stripe = getStripe(cfg.stripeSecretKey);
  const portal = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${origin.replace(/\/$/, "")}/settings`,
  });

  return NextResponse.json({ url: portal.url });
}
