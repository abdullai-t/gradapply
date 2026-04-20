import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { billingEnabled } from "@/lib/billing-config";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe-server";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!billingEnabled()) {
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

  const stripe = getStripe();
  const portal = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${origin.replace(/\/$/, "")}/settings`,
  });

  return NextResponse.json({ url: portal.url });
}
