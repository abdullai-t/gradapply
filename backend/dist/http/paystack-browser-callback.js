// @ts-nocheck
import { processPaystackReference } from "@/lib/paystack-fulfillment";
/** GET /api/billing/paystack/callback — Paystack redirect after payment. */
export async function paystackBrowserCallback(req) {
    const url = new URL(req.url);
    const ref = url.searchParams.get("reference") ?? url.searchParams.get("trxref");
    const origin = process.env.AUTH_URL?.trim() ||
        process.env.NEXTAUTH_URL?.trim() ||
        "http://localhost:3000";
    const base = origin.replace(/\/$/, "");
    if (!ref) {
        return Response.redirect(`${base}/settings?billing=error`);
    }
    const result = await processPaystackReference(ref);
    if (!result.applied && !result.duplicate) {
        return Response.redirect(`${base}/settings?billing=error`);
    }
    return Response.redirect(`${base}/settings?billing=success`);
}
