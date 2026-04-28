import { auth } from "@/auth";
import { getBillingAdminConfig } from "@/lib/billing-admin-config";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { canExportWithoutWatermark } from "@/lib/export-watermark";
import {
  paystackInitializeTransaction,
} from "@/lib/paystack-api";
import { prisma } from "@/lib/prisma";
import { isTrustedMutationOrigin } from "@/lib/request-origin";
import { getStripe } from "@/lib/stripe-server";

import { bad, forbidden, notFound, ok } from "../_responses";
import { withAuth } from "../_with-auth";

import { checkoutBodySchema, emailSchema } from "./schemas";

function normalizeEmail(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const deMailto = trimmed.replace(/^mailto:/i, "").trim();
  const lower = deMailto.toLowerCase();
  const parsed = emailSchema.safeParse(lower);
  return parsed.success ? parsed.data : null;
}

function ghsToMinor(value: number): number {
  return Math.max(0, Math.round(value * 100));
}

export const status = withAuth(async (_req, { userId }) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      planTier: true,
      aiUsageUsed: true,
      aiCreditsBalance: true,
      aiUsageMonth: true,
      freeEmailGenUsed: true,
      freeSopPreviewUsed: true,
      accessMode: true,
      accessReadOnlySince: true,
      subscriptionStatus: true,
      currentPeriodEnd: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
      paystackCustomerId: true,
    },
  });
  if (!user) return notFound();

  const now = new Date();
  const isExpired =
    user.planTier !== "FREE" &&
    user.currentPeriodEnd != null &&
    user.currentPeriodEnd.getTime() < now.getTime() &&
    user.subscriptionStatus !== "active" &&
    user.subscriptionStatus !== "trialing";
  if (isExpired && user.accessMode !== "READ_ONLY") {
    await prisma.user.update({
      where: { id: userId },
      data: {
        accessMode: "READ_ONLY",
        accessReadOnlySince: user.accessReadOnlySince ?? now,
      },
    });
    user.accessMode = "READ_ONLY";
  }

  const cfg = await getBillingAdminConfig();
  const stripeEnabled = Boolean(cfg.stripeSecretKey);
  const paystackEnabled = Boolean(cfg.paystackSecretKey);
  const billingEnabled = stripeEnabled || paystackEnabled;
  const canCheckoutPlus =
    (stripeEnabled && Boolean(cfg.stripePricePlus)) ||
    (paystackEnabled && cfg.displayPricePlusGhs > 0);
  const canCheckoutPro =
    (stripeEnabled && Boolean(cfg.stripePricePro)) ||
    (paystackEnabled && cfg.displayPriceProGhs > 0);
  const canCheckoutCredits =
    (stripeEnabled && Boolean(cfg.stripePriceCreditsPack)) ||
    (paystackEnabled && cfg.creditUnitPriceGhs > 0);
  const canCheckoutCvReview =
    (stripeEnabled && Boolean(cfg.stripePriceCvDeepReview)) ||
    (paystackEnabled && cfg.paystackAmountCvDeepReviewMinor > 0);
  const canCheckoutSopCritique =
    (stripeEnabled && Boolean(cfg.stripePriceSopDetailedCritique)) ||
    (paystackEnabled && cfg.paystackAmountSopDetailedCritiqueMinor > 0);
  const checkoutConfigured =
    canCheckoutPlus ||
    canCheckoutPro ||
    canCheckoutCredits ||
    canCheckoutCvReview ||
    canCheckoutSopCritique;
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
    canCheckoutCvReview,
    canCheckoutSopCritique,
    planTier: user.planTier,
    monthlyCredits: allowance,
    monthlyAllowance: allowance,
    aiUsageUsed: user.aiUsageUsed,
    aiUsageMonth: user.aiUsageMonth,
    aiCreditsBalance: user.aiCreditsBalance,
    freeEmailGenerationsRemaining:
      user.planTier === "FREE" ? Math.max(0, 1 - user.freeEmailGenUsed) : null,
    freeSopPreviewRemaining:
      user.planTier === "FREE" ? Math.max(0, 1 - user.freeSopPreviewUsed) : null,
    accessMode: user.accessMode,
    canExportWithoutWatermark: canExportWithoutWatermark(user.planTier),
    displayPriceProGhs: cfg.displayPriceProGhs,
    displayPricePlusGhs: cfg.displayPricePlusGhs,
    displayPriceCreditsPackGhs: cfg.displayPriceCreditsPackGhs,
    creditUnitPriceGhs: cfg.creditUnitPriceGhs,
    displayPriceProRenewalGhs: cfg.displayPriceProRenewalGhs,
    displayPricePlusRenewalGhs: cfg.displayPricePlusRenewalGhs,
    creditsPackSize: cfg.creditsPackSize,
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
  const renewal = parsed.data.renewal;
  const creditsAmount = parsed.data.creditsAmount;

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
  const session = await auth();
  const validEmail =
    normalizeEmail(user.email) ?? normalizeEmail(session?.user?.email);

  const priceId =
    tier === "plus"
      ? renewal
        ? (cfg.stripePricePlusRenewal ?? cfg.stripePricePlus)
        : cfg.stripePricePlus
      : tier === "pro"
        ? renewal
          ? (cfg.stripePriceProRenewal ?? cfg.stripePricePro)
          : cfg.stripePricePro
        : tier === "credits"
          ? cfg.stripePriceCreditsPack
          : tier === "cv_review"
            ? cfg.stripePriceCvDeepReview
            : cfg.stripePriceSopDetailedCritique;

  const stripeReady =
    stripeEnabled &&
    ((tier === "plus" && Boolean(cfg.stripePricePlus)) ||
      (tier === "pro" && Boolean(cfg.stripePricePro)) ||
      (tier === "credits" && Boolean(cfg.stripePriceCreditsPack)) ||
      (tier === "cv_review" && Boolean(cfg.stripePriceCvDeepReview)) ||
      (tier === "sop_critique" &&
        Boolean(cfg.stripePriceSopDetailedCritique)));

  if (stripeReady && priceId) {
    if (!user.stripeCustomerId && !validEmail) {
      return bad("Add a valid email address to your account before checkout.");
    }
    const stripe = getStripe(cfg.stripeSecretKey);

    if (tier === "credits" || tier === "cv_review" || tier === "sop_critique") {
      const creditQty = tier === "credits" ? (creditsAmount ?? cfg.creditsPackSize) : 1;
      const checkoutSession = await stripe.checkout.sessions.create({
        mode: "payment",
        ...(user.stripeCustomerId
          ? { customer: user.stripeCustomerId }
          : { customer_email: validEmail ?? undefined }),
        line_items: [{ price: priceId, quantity: creditQty }],
        metadata: {
          userId,
          checkoutKind:
            tier === "credits"
              ? "credits_pack"
              : tier === "cv_review"
                ? "cv_deep_review"
                : "sop_detailed_critique",
          tier,
          ...(tier === "credits" ? { creditsAmount: String(creditQty) } : {}),
        },
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
    ((tier === "plus" && cfg.displayPricePlusGhs > 0) ||
      (tier === "pro" && cfg.displayPriceProGhs > 0) ||
      (tier === "credits" && cfg.creditUnitPriceGhs > 0) ||
      (tier === "cv_review" && cfg.paystackAmountCvDeepReviewMinor > 0) ||
      (tier === "sop_critique" &&
        cfg.paystackAmountSopDetailedCritiqueMinor > 0));

  if (!paystackReady) {
    return bad(
      "No payment provider is configured for this plan. Add Stripe price IDs and/or Paystack plan codes (and PAYSTACK_AMOUNT_CREDITS_MINOR for credits) to the server environment.",
      503,
    );
  }

  if (
    !validEmail &&
    (tier === "credits" ||
      tier === "cv_review" ||
      tier === "sop_critique" ||
      !user.paystackCustomerId)
  ) {
    return bad(
      "Add a valid email address to your account before paying with Paystack.",
    );
  }

  const callbackUrl = `${base}/api/billing/paystack/callback`;

  if (tier === "credits" || tier === "cv_review" || tier === "sop_critique") {
    const creditQty = tier === "credits" ? (creditsAmount ?? cfg.creditsPackSize) : 1;
    const amountMinor =
      tier === "credits"
        ? Math.round(creditQty * cfg.creditUnitPriceGhs * 100)
        : tier === "cv_review"
          ? cfg.paystackAmountCvDeepReviewMinor
          : cfg.paystackAmountSopDetailedCritiqueMinor;
    let data;
    try {
      data = await paystackInitializeTransaction({
        email: validEmail!,
        amountMinor,
        currency: cfg.paystackCurrency,
        metadata: {
          userId,
          checkoutKind:
            tier === "credits"
              ? "credits_pack"
              : tier === "cv_review"
                ? "cv_deep_review"
                : "sop_detailed_critique",
          tier,
          ...(tier === "credits" ? { creditsAmount: String(creditQty) } : {}),
        },
        callbackUrl,
        secretKey: cfg.paystackSecretKey,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Paystack checkout initialization failed";
      if (message.toLowerCase().includes("invalid email address")) {
        return bad(
          "Paystack rejected your account email. Update your account email to a standard address (e.g. name@domain.com) and retry.",
        );
      }
      return bad(message);
    }
    return ok({ url: data.authorization_url });
  }

  const planTier = tier === "plus" ? ("PLUS" as const) : ("PRO" as const);
  const amountMinor = ghsToMinor(
    tier === "plus"
      ? renewal
        ? cfg.displayPricePlusRenewalGhs
        : cfg.displayPricePlusGhs
      : renewal
        ? cfg.displayPriceProRenewalGhs
        : cfg.displayPriceProGhs,
  );
  console.info("[billing][paystack] creating plan transaction", {
    userId,
    tier: planTier,
    amountMinor,
    currency: cfg.paystackCurrency,
    renewal,
  });

  try {
    const init = await paystackInitializeTransaction({
      email: validEmail!,
      amountMinor,
      currency: cfg.paystackCurrency,
      metadata: {
        userId,
        checkoutKind: "plan_purchase",
        tier: tier === "plus" ? "plus" : "pro",
        renewal: renewal ? "1" : "0",
      },
      callbackUrl,
      secretKey: cfg.paystackSecretKey,
    });
    return ok({ url: init.authorization_url });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Paystack plan checkout initialization failed";
    if (message.toLowerCase().includes("invalid email address")) {
      return bad(
        "Paystack rejected your account email. Update your account email to a standard address (e.g. name@domain.com) and retry.",
      );
    }
    return bad(message);
  }
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
