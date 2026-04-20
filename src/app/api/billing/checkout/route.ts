import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import {
  billingEnabled,
  paystackAmountCreditsMinor,
  paystackCheckoutReadyForTier,
  paystackPlanCodePlus,
  paystackPlanCodePro,
  stripeCheckoutReadyForTier,
  stripePriceCreditsPack,
  stripePricePlus,
  stripePricePro,
} from "@/lib/billing-config";
import { upsertPaystackSubscriptionUser } from "@/lib/paystack-fulfillment";
import {
  paystackCreateCustomer,
  paystackCreateSubscription,
  paystackCurrency,
  paystackInitializeTransaction,
} from "@/lib/paystack-api";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe-server";

const bodySchema = z.object({
  tier: z.enum(["plus", "pro", "credits"]),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!billingEnabled()) {
    return NextResponse.json(
      { error: "Billing is not configured on this server." },
      { status: 503 },
    );
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const tier = parsed.data.tier;

  const origin =
    process.env.AUTH_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    "http://localhost:3000";
  const base = origin.replace(/\/$/, "");
  const userId = session.user.id;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      email: true,
      stripeCustomerId: true,
      paystackCustomerId: true,
    },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const priceId =
    tier === "plus"
      ? stripePricePlus()
      : tier === "pro"
        ? stripePricePro()
        : stripePriceCreditsPack();

  if (stripeCheckoutReadyForTier(tier) && priceId) {
    const stripe = getStripe();

    if (tier === "credits") {
      const checkout = await stripe.checkout.sessions.create({
        mode: "payment",
        ...(user.stripeCustomerId
          ? { customer: user.stripeCustomerId }
          : { customer_email: user.email ?? undefined }),
        line_items: [{ price: priceId, quantity: 1 }],
        metadata: {
          userId,
          checkoutKind: "credits_pack",
        },
        success_url: `${base}/settings?billing=success`,
        cancel_url: `${base}/settings?billing=cancel`,
      });
      return NextResponse.json({ url: checkout.url });
    }

    const checkout = await stripe.checkout.sessions.create({
      mode: "subscription",
      ...(user.stripeCustomerId
        ? { customer: user.stripeCustomerId }
        : { customer_email: user.email ?? undefined }),
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { userId },
      subscription_data: {
        metadata: { userId },
      },
      success_url: `${base}/settings?billing=success`,
      cancel_url: `${base}/settings?billing=cancel`,
    });

    return NextResponse.json({ url: checkout.url });
  }

  if (!paystackCheckoutReadyForTier(tier)) {
    return NextResponse.json(
      {
        error:
          "No payment provider is configured for this plan. Add Stripe price IDs and/or Paystack plan codes (and PAYSTACK_AMOUNT_CREDITS_MINOR for credits) to the server environment.",
      },
      { status: 503 },
    );
  }

  const email = user.email?.trim();
  if (!email) {
    return NextResponse.json(
      {
        error:
          "Add an email address to your account before paying with Paystack.",
      },
      { status: 400 },
    );
  }

  const callbackUrl = `${base}/api/billing/paystack/callback`;

  if (tier === "credits") {
    const data = await paystackInitializeTransaction({
      email,
      amountMinor: paystackAmountCreditsMinor(),
      currency: paystackCurrency(),
      metadata: {
        userId,
        checkoutKind: "credits_pack",
        tier: "credits",
      },
      callbackUrl,
    });
    return NextResponse.json({ url: data.authorization_url });
  }

  let customerIdNum: number | null = user.paystackCustomerId
    ? Number(user.paystackCustomerId)
    : null;

  if (
    customerIdNum == null ||
    !Number.isFinite(customerIdNum) ||
    customerIdNum <= 0
  ) {
    const cust = await paystackCreateCustomer({
      email,
      metadata: { userId },
    });
    customerIdNum = cust.id!;
    await prisma.user.update({
      where: { id: userId },
      data: { paystackCustomerId: String(customerIdNum) },
    });
  }

  const planCode =
    tier === "plus" ? paystackPlanCodePlus()! : paystackPlanCodePro()!;
  const planTier = tier === "plus" ? ("PLUS" as const) : ("PRO" as const);

  const sub = await paystackCreateSubscription({
    customerId: customerIdNum,
    planCode,
  });

  if (sub.authorization_url) {
    return NextResponse.json({ url: sub.authorization_url });
  }

  await upsertPaystackSubscriptionUser({
    userId,
    customerId: customerIdNum,
    tier: planTier,
    sub,
  });

  return NextResponse.json({
    url: `${base}/settings?billing=success`,
  });
}
