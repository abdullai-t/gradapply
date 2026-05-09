// @ts-nocheck
/**
 * Paystack REST API (https://paystack.com/docs/api) using the secret key.
 * Amounts are in the currency’s smallest unit (e.g. pesewas for GHS, kobo for NGN).
 */
import { createHmac } from "node:crypto";
const BASE = "https://api.paystack.co";
export function paystackSecretKey() {
    return process.env.PAYSTACK_SECRET_KEY?.trim();
}
export function paystackCurrency() {
    return (process.env.PAYSTACK_CURRENCY?.trim().toUpperCase() ||
        "GHS");
}
async function paystackFetch(path, secretKey, init) {
    const key = secretKey?.trim() || paystackSecretKey();
    if (!key)
        throw new Error("PAYSTACK_SECRET_KEY is not configured");
    const res = await fetch(`${BASE}${path}`, {
        ...init,
        headers: {
            Authorization: `Bearer ${key}`,
            Accept: "application/json",
            "Content-Type": "application/json",
            ...(init?.headers ?? {}),
        },
    });
    const json = (await res.json());
    return { ok: res.ok, json };
}
export async function paystackInitializeTransaction(opts) {
    const { ok, json } = await paystackFetch("/transaction/initialize", opts.secretKey, {
        method: "POST",
        body: JSON.stringify({
            email: opts.email,
            amount: opts.amountMinor,
            currency: opts.currency,
            metadata: opts.metadata,
            callback_url: opts.callbackUrl,
        }),
    });
    if (!ok || !json.status || !json.data?.authorization_url) {
        throw new Error(json.message || "Paystack initialize failed");
    }
    return json.data;
}
export async function paystackVerifyTransaction(reference, secretKey) {
    const { ok, json } = await paystackFetch(`/transaction/verify/${encodeURIComponent(reference)}`, secretKey, { method: "GET" });
    if (!ok || !json.status || !json.data)
        return null;
    return {
        status: json.data.status,
        reference: json.data.reference,
        paidAt: json.data.paid_at,
        amount: json.data.amount,
        currency: json.data.currency,
        metadata: json.data.metadata,
        customer: json.data.customer,
        plan: json.data.plan,
    };
}
export async function paystackCreateCustomer(opts) {
    const { ok, json } = await paystackFetch("/customer", opts.secretKey, {
        method: "POST",
        body: JSON.stringify({
            email: opts.email,
            metadata: opts.metadata,
        }),
    });
    if (!ok || !json.status || !json.data?.id) {
        throw new Error(json.message || "Paystack customer creation failed");
    }
    return json.data;
}
export async function paystackCreateSubscription(opts) {
    const { ok, json } = await paystackFetch("/subscription", opts.secretKey, {
        method: "POST",
        body: JSON.stringify({
            customer: opts.customerId,
            plan: opts.planCode,
        }),
    });
    if (!ok || !json.status || !json.data) {
        throw new Error(json.message || "Paystack subscription failed");
    }
    return json.data;
}
export function computePaystackSignature(rawBody, secretKey) {
    const secret = secretKey?.trim() || paystackSecretKey();
    if (!secret)
        throw new Error("No Paystack secret");
    return createHmac("sha512", secret).update(rawBody).digest("hex");
}
export function verifyPaystackWebhookSignature(rawBody, signatureHeader, secretKey) {
    if (!signatureHeader)
        return false;
    try {
        return computePaystackSignature(rawBody, secretKey) === signatureHeader;
    }
    catch {
        return false;
    }
}
