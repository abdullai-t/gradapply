import { NextResponse } from "next/server";
import type Stripe from "stripe";

import {
  grantCreditsPackToUser,
  resetMonthlyUsageForSubscription,
  syncUserSubscriptionFromStripe,
} from "@/lib/billing-stripe-sync";
import { getBillingAdminConfig } from "@/lib/billing-admin-config";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function markProcessed(eventId: string): Promise<boolean> {
  try {
    await prisma.stripeEventLog.create({ data: { eventId } });
    return true;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const cfg = await getBillingAdminConfig();
  const secret = cfg.stripeWebhookSecret;
  if (!secret || !cfg.stripeSecretKey) {
    return NextResponse.json(
      { error: "Stripe webhook configuration is incomplete" },
      { status: 503 },
    );
  }

  const buf = Buffer.from(await req.arrayBuffer());
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe(cfg.stripeSecretKey).webhooks.constructEvent(buf, sig, secret);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid payload";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const locked = await markProcessed(event.id);
  if (!locked) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        if (!userId) break;

        const customerId =
          typeof session.customer === "string"
            ? session.customer
            : session.customer?.id;
        if (customerId) {
          await prisma.user.update({
            where: { id: userId },
            data: { stripeCustomerId: customerId },
          });
        }

        if (session.mode === "payment") {
          if (
            session.metadata?.checkoutKind === "credits_pack" &&
            session.payment_status === "paid"
          ) {
            await grantCreditsPackToUser(userId);
          }
        }

        if (session.mode === "subscription") {
          const subId =
            typeof session.subscription === "string"
              ? session.subscription
              : session.subscription?.id;
          if (subId) {
            const sub = await getStripe(cfg.stripeSecretKey).subscriptions.retrieve(subId);
            await syncUserSubscriptionFromStripe(userId, sub);
          }
        }
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.created": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.userId;
        if (userId) {
          await syncUserSubscriptionFromStripe(userId, sub);
          break;
        }
        const local = await prisma.user.findFirst({
          where: { stripeSubscriptionId: sub.id },
          select: { id: true },
        });
        if (local) await syncUserSubscriptionFromStripe(local.id, sub);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await prisma.user.updateMany({
          where: { stripeSubscriptionId: sub.id },
          data: {
            stripeSubscriptionId: null,
            stripePriceId: null,
            subscriptionStatus: "canceled",
            planTier: "FREE",
          },
        });
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        if (
          invoice.billing_reason === "subscription_cycle" &&
          invoice.subscription
        ) {
          const sid =
            typeof invoice.subscription === "string"
              ? invoice.subscription
              : invoice.subscription.id;
          await resetMonthlyUsageForSubscription(sid);
        }
        break;
      }

      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (e) {
    await prisma.stripeEventLog.deleteMany({ where: { eventId: event.id } });
    console.error("[stripe webhook]", e);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 },
    );
  }
}
