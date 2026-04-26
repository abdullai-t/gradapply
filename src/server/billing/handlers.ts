import { getBillingAdminConfig } from "@/lib/billing-admin-config";
import { isFeatureEnabled } from "@/lib/feature-flags";
import {
  paystackCreateCustomer,
  paystackCreateSubscription,
  paystackInitializeTransaction,
} from "@/lib/paystack-api";
import { upsertPaystackSubscriptionUser } from "@/lib/paystack-fulfillment";
import { prisma } from "@/lib/prisma";
import { isTrustedMutationOrigin } from "@/lib/request-origin";
import { getStripe } from "@/lib/stripe-server";

import { bad, forbidden, notFound, ok } from "../_responses";
import { withAuth } from "../_with-auth";

import { checkoutBodySchema, emailSchema } from "./schemas";

export const status = withAuth(async (_req, { userId }) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      planTier: true,
      aiUsageUsed: true,
      aiCreditsBalance: true,
      subscriptionStatus: true,
      currentPeriodEnd: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
      paystackCustomerId: true,
    },
  });
  if (!user) return notFound();

  const cfg = await getBillingAdminConfig();
  const stripeEnabled = Boolean(cfg.stripeSecretKey);
  const paystackEnabled = Boolean(cfg.paystackSecretKey);
  const billingEnabled = stripeEnabled || paystackEnabled;
  const canCheckoutPlus =
    (stripeEnabled && Boolean(cfg.stripePricePlus)) ||
    (paystackEnabled && Boolean(cfg.paystackPlanCodePlus));
  const canCheckoutPro =
    (stripeEnabled && Boolean(cfg.stripePricePro)) ||
    (paystackEnabled && Boolean(cfg.paystackPlanCodePro));
  const canCheckoutCredits =
    (stripeEnabled && Boolean(cfg.stripePriceCreditsPack)) ||
    (paystackEnabled && cfg.paystackAmountCreditsMinor > 0);
  const checkoutConfigured =
    canCheckoutPlus || canCheckoutPro || canCheckoutCredits;
  const allowance = cfg.allowance[user.planTier];
  const settingsEnabled = await isFeatureEnabled("user_settings_page", false, {
    fresh: true,
  });
  const supportTabEnabled = await isFeatureEnabled("support_tab", false, {
    fresh: true,
  });

  return ok({
    billingEnabled,
    checkoutConfigured,
    stripeEnabled,
    paystackEnabled,
    canCheckoutPlus,
    canCheckoutPro,
    canCheckoutCredits,
    planTier: user.planTier,
    monthlyAllowance: allowance,
    aiUsageUsed: user.aiUsageUsed,
    aiCreditsBalance: user.aiCreditsBalance,
    subscriptionStatus: user.subscriptionStatus,
    currentPeriodEnd: user.currentPeriodEnd?.toISOString() ?? null,
    hasStripeCustomer: Boolean(user.stripeCustomerId),
    hasSubscription: Boolean(user.stripeSubscriptionId),
    hasPaystackCustomer: Boolean(user.paystackCustomerId),
    settingsEnabled,
    supportTabEnabled,
  });
});

export const checkout = withAuth(async (req, { userId }) => {
  if (!isTrustedMutationOrigin(req)) return forbidden("Untrusted origin");

  const cfg = await getBillingAdminConfig();
  const stripeEnabled = Boolean(cfg.stripeSecretKey);
  const paystackEnabled = Boolean(cfg.paystackSecretKey);
  if (!stripeEnabled && !paystackEnabled)
    return bad("Billing is not configured on this server.", 503);

  const json = await req.json().catch(() => null);
  const parsed = checkoutBodySchema.safeParse(json);
  if (!parsed.success) return bad(parsed.error.flatten());

  const tier = parsed.data.tier;

  const origin =
    process.env.AUTH_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    "http://localhost:3000";
  const base = origin.replace(/\/$/, "");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      stripeCustomerId: true,
      paystackCustomerId: true,
    },
  });
  if (!user) return notFound();
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
      return bad("Add a valid email address to your account before checkout.");
    }
    const stripe = getStripe(cfg.stripeSecretKey);

    if (tier === "credits") {
      const checkoutSession = await stripe.checkout.sessions.create({
        mode: "payment",
        ...(user.stripeCustomerId
          ? { customer: user.stripeCustomerId }
          : { customer_email: validEmail ?? undefined }),
        line_items: [{ price: priceId, quantity: 1 }],
        metadata: { userId, checkoutKind: "credits_pack" },
        success_url: `${base}/settings?billing=success`,
        cancel_url: `${base}/settings?billing=cancel`,
      });
      return ok({ url: checkoutSession.url });
    }

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      ...(user.stripeCustomerId
        ? { customer: user.stripeCustomerId }
        : { customer_email: validEmail ?? undefined }),
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { userId },
      subscription_data: { metadata: { userId } },
      success_url: `${base}/settings?billing=success`,
      cancel_url: `${base}/settings?billing=cancel`,
    });

    return ok({ url: checkoutSession.url });
  }

  const paystackReady =
    paystackEnabled &&
    ((tier === "plus" && Boolean(cfg.paystackPlanCodePlus)) ||
      (tier === "pro" && Boolean(cfg.paystackPlanCodePro)) ||
      (tier === "credits" && cfg.paystackAmountCreditsMinor > 0));

  if (!paystackReady) {
    return bad(
      "No payment provider is configured for this plan. Add Stripe price IDs and/or Paystack plan codes (and PAYSTACK_AMOUNT_CREDITS_MINOR for credits) to the server environment.",
      503,
    );
  }

  if (!validEmail && (tier === "credits" || !user.paystackCustomerId)) {
    return bad(
      "Add a valid email address to your account before paying with Paystack.",
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
        metadata: { userId, checkoutKind: "credits_pack", tier: "credits" },
        callbackUrl,
        secretKey: cfg.paystackSecretKey,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Paystack checkout initialization failed";
      return bad(message);
    }
    return ok({ url: data.authorization_url });
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
        error instanceof Error
          ? error.message
          : "Paystack customer creation failed";
      return bad(message);
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
    const customerMissing = message
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
        return bad(
          "Stored Paystack customer is invalid and your account email is missing/invalid. Update your email, then retry checkout.",
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
        return bad(
          retryMessage === "Plan code is invalid"
            ? "Paystack plan code is invalid. Update the plan code in Admin > Pricing & billing."
            : retryMessage,
        );
      }
    } else {
      return bad(
        message === "Plan code is invalid"
          ? "Paystack plan code is invalid. Update the plan code in Admin > Pricing & billing."
          : message,
      );
    }
  }

  if (sub.authorization_url) {
    return ok({ url: sub.authorization_url });
  }

  await upsertPaystackSubscriptionUser({
    userId,
    customerId: customerIdNum,
    tier: planTier,
    sub,
  });

  return ok({ url: `${base}/settings?billing=success` });
});

export const portal = withAuth(async (req, { userId }) => {
  if (!isTrustedMutationOrigin(req)) return forbidden("Untrusted origin");

  const cfg = await getBillingAdminConfig();
  if (!cfg.stripeSecretKey && !cfg.paystackSecretKey)
    return bad("Billing is not configured on this server.", 503);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { stripeCustomerId: true },
  });

  if (!user?.stripeCustomerId)
    return bad("No Stripe customer on file. Subscribe or buy credits first.");

  const origin =
    process.env.AUTH_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    "http://localhost:3000";

  if (!cfg.stripeSecretKey)
    return bad("Stripe portal is not configured on this server.", 503);

  const stripe = getStripe(cfg.stripeSecretKey);
  const portalSession = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${origin.replace(/\/$/, "")}/settings`,
  });

  return ok({ url: portalSession.url });
});
