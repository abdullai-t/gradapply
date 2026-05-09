// @ts-nocheck
/**
 * Paystack REST API (https://paystack.com/docs/api) using the secret key.
 * Amounts are in the currency’s smallest unit (e.g. pesewas for GHS, kobo for NGN).
 */

import { createHmac } from "node:crypto";

const BASE = "https://api.paystack.co";

export function paystackSecretKey(): string | undefined {
  return process.env.PAYSTACK_SECRET_KEY?.trim();
}

export function paystackCurrency(): string {
  return (
    process.env.PAYSTACK_CURRENCY?.trim().toUpperCase() ||
    "GHS"
  );
}

async function paystackFetch<T>(
  path: string,
  secretKey: string | undefined,
  init?: RequestInit,
): Promise<{ ok: boolean; json: T }> {
  const key = secretKey?.trim() || paystackSecretKey();
  if (!key) throw new Error("PAYSTACK_SECRET_KEY is not configured");

  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const json = (await res.json()) as T;
  return { ok: res.ok, json };
}

export type PaystackInitializeData = {
  authorization_url?: string;
  access_code?: string;
  reference?: string;
};

export async function paystackInitializeTransaction(opts: {
  email: string;
  amountMinor: number;
  currency: string;
  metadata: Record<string, string>;
  callbackUrl: string;
  secretKey?: string;
}): Promise<PaystackInitializeData> {
  type Res = { status: boolean; message: string; data?: PaystackInitializeData };
  const { ok, json } = await paystackFetch<Res>(
    "/transaction/initialize",
    opts.secretKey,
    {
      method: "POST",
      body: JSON.stringify({
        email: opts.email,
        amount: opts.amountMinor,
        currency: opts.currency,
        metadata: opts.metadata,
        callback_url: opts.callbackUrl,
      }),
    },
  );

  if (!ok || !json.status || !json.data?.authorization_url) {
    throw new Error(json.message || "Paystack initialize failed");
  }
  return json.data;
}

export type PaystackVerifyData = {
  status?: string;
  reference?: string;
  paidAt?: string;
  amount?: number;
  currency?: string;
  metadata?: Record<string, unknown>;
  customer?: { id?: number; email?: string };
  /** Present on subscription-related charges (maps from Paystack `data.plan`). */
  plan?: { plan_code?: string; id?: number; name?: string };
};

export async function paystackVerifyTransaction(
  reference: string,
  secretKey?: string,
): Promise<PaystackVerifyData | null> {
  type Res = {
    status: boolean;
    message: string;
    data?: {
      status?: string;
      reference?: string;
        paid_at?: string;
        amount?: number;
        currency?: string;
      metadata?: Record<string, unknown>;
      customer?: { id?: number; email?: string };
      plan?: { plan_code?: string; id?: number; name?: string };
    };
  };
  const { ok, json } = await paystackFetch<Res>(
    `/transaction/verify/${encodeURIComponent(reference)}`,
    secretKey,
    { method: "GET" },
  );

  if (!ok || !json.status || !json.data) return null;
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

export type PaystackCustomerData = {
  id?: number;
  customer_code?: string;
  email?: string;
};

export async function paystackCreateCustomer(opts: {
  email: string;
  metadata?: Record<string, string>;
  secretKey?: string;
}): Promise<PaystackCustomerData> {
  type Res = {
    status: boolean;
    message: string;
    data?: PaystackCustomerData;
  };
  const { ok, json } = await paystackFetch<Res>("/customer", opts.secretKey, {
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

export type PaystackSubscriptionData = {
  subscription_code?: string;
  status?: string;
  next_payment_date?: string | null;
  authorization_url?: string;
  customer?: number;
  plan?: { plan_code?: string };
};

export async function paystackCreateSubscription(opts: {
  /** Numeric customer id from Paystack */
  customerId: number;
  planCode: string;
  secretKey?: string;
}): Promise<PaystackSubscriptionData> {
  type Res = {
    status: boolean;
    message: string;
    data?: PaystackSubscriptionData;
  };
  const { ok, json } = await paystackFetch<Res>(
    "/subscription",
    opts.secretKey,
    {
      method: "POST",
      body: JSON.stringify({
        customer: opts.customerId,
        plan: opts.planCode,
      }),
    },
  );

  if (!ok || !json.status || !json.data) {
    throw new Error(json.message || "Paystack subscription failed");
  }
  return json.data;
}

export function computePaystackSignature(
  rawBody: string,
  secretKey?: string,
): string {
  const secret = secretKey?.trim() || paystackSecretKey();
  if (!secret) throw new Error("No Paystack secret");
  return createHmac("sha512", secret).update(rawBody).digest("hex");
}

export function verifyPaystackWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secretKey?: string,
): boolean {
  if (!signatureHeader) return false;
  try {
    return computePaystackSignature(rawBody, secretKey) === signatureHeader;
  } catch {
    return false;
  }
}
