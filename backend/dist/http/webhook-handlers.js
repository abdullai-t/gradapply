import { grantCreditsPackToUser, resetMonthlyUsageForSubscription, syncUserSubscriptionFromStripe, } from "@/lib/billing-stripe-sync";
import { getBillingAdminConfig } from "@/lib/billing-admin-config";
import { processPaystackReference } from "@/lib/paystack-fulfillment";
import { prisma } from "@/lib/prisma";
import { verifyPaystackWebhookSignature, } from "@/lib/paystack-api";
import { getStripe } from "@/lib/stripe-server";
async function markProcessed(eventId) {
    try {
        await prisma.stripeEventLog.create({ data: { eventId } });
        return true;
    }
    catch {
        return false;
    }
}
/** POST /api/webhooks/stripe — raw body required (Stripe signature). */
export async function stripeWebhookPost(req) {
    const cfg = await getBillingAdminConfig();
    const secret = cfg.stripeWebhookSecret;
    if (!secret || !cfg.stripeSecretKey) {
        return Response.json({ error: "Stripe webhook configuration is incomplete" }, { status: 503 });
    }
    const buf = Buffer.from(await req.arrayBuffer());
    const sig = req.headers.get("stripe-signature");
    if (!sig) {
        return Response.json({ error: "Missing stripe-signature" }, { status: 400 });
    }
    let event;
    try {
        event = getStripe(cfg.stripeSecretKey).webhooks.constructEvent(buf, sig, secret);
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : "Invalid payload";
        return Response.json({ error: msg }, { status: 400 });
    }
    const locked = await markProcessed(event.id);
    if (!locked) {
        return Response.json({ received: true, duplicate: true });
    }
    try {
        switch (event.type) {
            case "checkout.session.completed": {
                const session = event.data.object;
                const userId = session.metadata?.userId;
                if (!userId)
                    break;
                const customerId = typeof session.customer === "string"
                    ? session.customer
                    : session.customer?.id;
                if (customerId) {
                    await prisma.user.update({
                        where: { id: userId },
                        data: { stripeCustomerId: customerId },
                    });
                }
                if (session.mode === "payment") {
                    if (session.metadata?.checkoutKind === "credits_pack" &&
                        session.payment_status === "paid") {
                        const purchasedCredits = Number.parseInt(session.metadata?.creditsAmount ?? "", 10);
                        await grantCreditsPackToUser(userId, Number.isFinite(purchasedCredits) ? purchasedCredits : undefined);
                    }
                }
                if (session.mode === "subscription") {
                    const subId = typeof session.subscription === "string"
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
                const sub = event.data.object;
                const userId = sub.metadata?.userId;
                if (userId) {
                    await syncUserSubscriptionFromStripe(userId, sub);
                    break;
                }
                const local = await prisma.user.findFirst({
                    where: { stripeSubscriptionId: sub.id },
                    select: { id: true },
                });
                if (local)
                    await syncUserSubscriptionFromStripe(local.id, sub);
                break;
            }
            case "customer.subscription.deleted": {
                const sub = event.data.object;
                await prisma.user.updateMany({
                    where: { stripeSubscriptionId: sub.id },
                    data: {
                        stripeSubscriptionId: null,
                        stripePriceId: null,
                        subscriptionStatus: "canceled",
                        planTier: "FREE",
                        accessMode: "READ_ONLY",
                        accessReadOnlySince: new Date(),
                    },
                });
                break;
            }
            case "invoice.paid": {
                const invoice = event.data.object;
                if (invoice.billing_reason === "subscription_cycle" &&
                    invoice.subscription) {
                    const sid = typeof invoice.subscription === "string"
                        ? invoice.subscription
                        : invoice.subscription.id;
                    await resetMonthlyUsageForSubscription(sid);
                }
                break;
            }
            default:
                break;
        }
        return Response.json({ received: true });
    }
    catch (e) {
        await prisma.stripeEventLog.deleteMany({ where: { eventId: event.id } });
        console.error("[stripe webhook]", e);
        return Response.json({ error: "Webhook handler failed" }, { status: 500 });
    }
}
/** POST /api/webhooks/paystack */
export async function paystackWebhookPost(req) {
    const cfg = await getBillingAdminConfig();
    const raw = await req.text();
    const sig = req.headers.get("x-paystack-signature");
    if (!verifyPaystackWebhookSignature(raw, sig, cfg.paystackSecretKey)) {
        return Response.json({ error: "Invalid signature" }, { status: 400 });
    }
    let body;
    try {
        body = JSON.parse(raw);
    }
    catch {
        return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const ref = body.data?.reference;
    if (body.event === "charge.success" &&
        typeof ref === "string" &&
        ref.length > 0) {
        await processPaystackReference(ref);
    }
    return Response.json({ received: true });
}
