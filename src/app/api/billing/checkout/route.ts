import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { getBillingAdminConfig } from "@/lib/billing-admin-config";
import { upsertPaystackSubscriptionUser } from "@/lib/paystack-fulfillment";
import {
  paystackCreateCustomer,
  paystackCreateSubscription,
  paystackInitializeTransaction,
} from "@/lib/paystack-api";
import { prisma } from "@/lib/prisma";
import { isTrustedMutationOrigin } from "@/lib/request-origin";
import { getStripe } from "@/lib/stripe-server";

const bodySchema = z.object({
  tier: z.enum(["plus", "pro", "credits"]),
});
const emailSchema = z.string().trim().email();

export async function POST(req: Request) {
  if (!isTrustedMutationOrigin(req)) {
    return NextResponse.json({ error: "Untrusted origin" }, { status: 403 });
  }
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cfg = await getBillingAdminConfig();
  const stripeEnabled = Boolean(cfg.stripeSecretKey);
  const paystackEnabled = Boolean(cfg.paystackSecretKey);
  if (!stripeEnabled && !paystackEnabled) {
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
  const validEmail = emailSchema.safeParse(user.email ?? "").success
    ? emailSchema.parse(user.email)
    : null;

  const priceId =
    tier === "plus"
      ? cfg.stripePricePlus
      : tier === "pro"
        ? cfg.stripePricePro
        : cfg.stripePriceCreditsPack;

  const stripeReady =
    stripeEnabled &&
    ((tier === "plus" && Boolean(cfg.stripePricePlus)) ||
      (tier === "pro" && Boolean(cfg.stripePricePro)) ||
      (tier === "credits" && Boolean(cfg.stripePriceCreditsPack)));

  if (stripeReady && priceId) {
    if (!user.stripeCustomerId && !validEmail) {
      return NextResponse.json(
        { error: "Add a valid email address to your account before checkout." },
        { status: 400 },
      );
    }
    const stripe = getStripe(cfg.stripeSecretKey);

    if (tier === "credits") {
      const checkout = await stripe.checkout.sessions.create({
        mode: "payment",
        ...(user.stripeCustomerId
          ? { customer: user.stripeCustomerId }
          : { customer_email: validEmail ?? undefined }),
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
        : { customer_email: validEmail ?? undefined }),
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

  const paystackReady =
    paystackEnabled &&
    ((tier === "plus" && Boolean(cfg.paystackPlanCodePlus)) ||
      (tier === "pro" && Boolean(cfg.paystackPlanCodePro)) ||
      (tier === "credits" && cfg.paystackAmountCreditsMinor > 0));

  if (!paystackReady) {
    return NextResponse.json(
      {
        error:
          "No payment provider is configured for this plan. Add Stripe price IDs and/or Paystack plan codes (and PAYSTACK_AMOUNT_CREDITS_MINOR for credits) to the server environment.",
      },
      { status: 503 },
    );
  }

  if (!validEmail && (tier === "credits" || !user.paystackCustomerId)) {
    return NextResponse.json(
      {
        error:
          "Add a valid email address to your account before paying with Paystack.",
      },
      { status: 400 },
    );
  }

  const callbackUrl = `${base}/api/billing/paystack/callback`;

  if (tier === "credits") {
    let data;
    try {
      data = await paystackInitializeTransaction({
        email: validEmail!,
        amountMinor: cfg.paystackAmountCreditsMinor,
        currency: cfg.paystackCurrency,
        metadata: {
          userId,
          checkoutKind: "credits_pack",
          tier: "credits",
        },
        callbackUrl,
        secretKey: cfg.paystackSecretKey,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Paystack checkout initialization failed";
      return NextResponse.json({ error: message }, { status: 400 });
    }
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
    let cust;
    try {
      cust = await paystackCreateCustomer({
        email: validEmail!,
        metadata: { userId },
        secretKey: cfg.paystackSecretKey,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Paystack customer creation failed";
      return NextResponse.json({ error: message }, { status: 400 });
    }
    customerIdNum = cust.id!;
    await prisma.user.update({
      where: { id: userId },
      data: { paystackCustomerId: String(customerIdNum) },
    });
  }

  const planCode =
    tier === "plus" ? cfg.paystackPlanCodePlus! : cfg.paystackPlanCodePro!;
  const planTier = tier === "plus" ? ("PLUS" as const) : ("PRO" as const);
  console.info("[billing][paystack] creating subscription", {
    userId,
    tier: planTier,
    planCode,
  });

  let sub;
  try {
    sub = await paystackCreateSubscription({
      customerId: customerIdNum,
      planCode,
      secretKey: cfg.paystackSecretKey,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Paystack subscription failed";
    const customerMissing =
      message
        .toLowerCase()
        .includes("customer with the specified email or code was not found");
    console.error("[billing][paystack] subscription failed", {
      userId,
      tier: planTier,
      planCode,
      customerIdNum,
      message,
    });
    if (customerMissing) {
      if (!validEmail) {
        return NextResponse.json(
          {
            error:
              "Stored Paystack customer is invalid and your account email is missing/invalid. Update your email, then retry checkout.",
          },
          { status: 400 },
        );
      }

      try {
        console.warn("[billing][paystack] recreating missing customer", {
          userId,
          tier: planTier,
          planCode,
          previousCustomerId: customerIdNum,
        });
        const refreshed = await paystackCreateCustomer({
          email: validEmail,
          metadata: { userId },
          secretKey: cfg.paystackSecretKey,
        });
        customerIdNum = refreshed.id!;
        await prisma.user.update({
          where: { id: userId },
          data: { paystackCustomerId: String(customerIdNum) },
        });
        sub = await paystackCreateSubscription({
          customerId: customerIdNum,
          planCode,
          secretKey: cfg.paystackSecretKey,
        });
      } catch (retryError) {
        const retryMessage =
          retryError instanceof Error
            ? retryError.message
            : "Paystack subscription failed after customer refresh";
        return NextResponse.json(
          {
            error:
              retryMessage === "Plan code is invalid"
                ? "Paystack plan code is invalid. Update the plan code in Admin > Pricing & billing."
                : retryMessage,
          },
          { status: 400 },
        );
      }
    } else {
      return NextResponse.json(
        {
          error:
            message === "Plan code is invalid"
              ? "Paystack plan code is invalid. Update the plan code in Admin > Pricing & billing."
              : message,
        },
        { status: 400 },
      );
    }
  }

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
