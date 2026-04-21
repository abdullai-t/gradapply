import { NextResponse } from "next/server";
import { z } from "zod";

import { requireElevatedUser } from "@/lib/admin-auth";
import {
  BILLING_SETTING_KEYS,
  getAppSettingValue,
  setAppSettingValue,
} from "@/lib/app-settings";
import { getBillingAdminConfig } from "@/lib/billing-admin-config";
import { isTrustedMutationOrigin } from "@/lib/request-origin";

const updateSchema = z.object({
  stripeSecretKey: z.string().trim().min(1).optional(),
  stripeWebhookSecret: z.string().trim().min(1).optional(),
  paystackSecretKey: z.string().trim().min(1).optional(),
  paystackCurrency: z.string().trim().min(3).max(10).optional(),
  stripePricePlus: z.string().trim().min(1).optional(),
  stripePricePro: z.string().trim().min(1).optional(),
  stripePriceCreditsPack: z.string().trim().min(1).optional(),
  paystackPlanCodePlus: z.string().trim().min(1).optional(),
  paystackPlanCodePro: z.string().trim().min(1).optional(),
  paystackAmountCreditsMinor: z.number().int().min(0).optional(),
  allowanceFree: z.number().int().min(0).optional(),
  allowancePlus: z.number().int().min(0).optional(),
  allowancePro: z.number().int().min(0).optional(),
  creditsPackSize: z.number().int().min(1).optional(),
});

export async function GET() {
  const actor = await requireElevatedUser();
  if (!actor) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const cfg = await getBillingAdminConfig();
  const [stripeSecretKeyRaw, stripeWebhookSecretRaw, paystackSecretKeyRaw] =
    await Promise.all([
      getAppSettingValue(BILLING_SETTING_KEYS.stripeSecretKey),
      getAppSettingValue(BILLING_SETTING_KEYS.stripeWebhookSecret),
      getAppSettingValue(BILLING_SETTING_KEYS.paystackSecretKey),
    ]);

  return NextResponse.json(
    {
      actorRole: actor.role,
      settings: {
        stripeSecretKeySet: Boolean(stripeSecretKeyRaw || cfg.stripeSecretKey),
        stripeWebhookSecretSet: Boolean(
          stripeWebhookSecretRaw || cfg.stripeWebhookSecret,
        ),
        paystackSecretKeySet: Boolean(paystackSecretKeyRaw || cfg.paystackSecretKey),
        paystackCurrency: cfg.paystackCurrency,
        stripePricePlus: cfg.stripePricePlus ?? "",
        stripePricePro: cfg.stripePricePro ?? "",
        stripePriceCreditsPack: cfg.stripePriceCreditsPack ?? "",
        paystackPlanCodePlus: cfg.paystackPlanCodePlus ?? "",
        paystackPlanCodePro: cfg.paystackPlanCodePro ?? "",
        paystackAmountCreditsMinor: cfg.paystackAmountCreditsMinor,
        allowanceFree: cfg.allowance.FREE,
        allowancePlus: cfg.allowance.PLUS,
        allowancePro: cfg.allowance.PRO,
        creditsPackSize: cfg.creditsPackSize,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function PATCH(req: Request) {
  if (!isTrustedMutationOrigin(req)) {
    return NextResponse.json({ error: "Untrusted origin" }, { status: 403 });
  }

  const actor = await requireElevatedUser();
  if (!actor) {
    return NextResponse.json(
      { error: "Only admins can update admin config." },
      { status: 403 },
    );
  }

  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const updates = parsed.data;
  const ops: Promise<void>[] = [];

  const put = (key: string, value: string, secret = false) => {
    ops.push(setAppSettingValue({ key, value, secret }));
  };

  if (updates.stripeSecretKey) {
    put(BILLING_SETTING_KEYS.stripeSecretKey, updates.stripeSecretKey, true);
  }
  if (updates.stripeWebhookSecret) {
    put(
      BILLING_SETTING_KEYS.stripeWebhookSecret,
      updates.stripeWebhookSecret,
      true,
    );
  }
  if (updates.paystackSecretKey) {
    put(BILLING_SETTING_KEYS.paystackSecretKey, updates.paystackSecretKey, true);
  }
  if (updates.paystackCurrency) {
    put(
      BILLING_SETTING_KEYS.paystackCurrency,
      updates.paystackCurrency.toUpperCase(),
    );
  }
  if (updates.stripePricePlus) {
    put(BILLING_SETTING_KEYS.stripePricePlus, updates.stripePricePlus);
  }
  if (updates.stripePricePro) {
    put(BILLING_SETTING_KEYS.stripePricePro, updates.stripePricePro);
  }
  if (updates.stripePriceCreditsPack) {
    put(
      BILLING_SETTING_KEYS.stripePriceCreditsPack,
      updates.stripePriceCreditsPack,
    );
  }
  if (updates.paystackPlanCodePlus) {
    put(BILLING_SETTING_KEYS.paystackPlanCodePlus, updates.paystackPlanCodePlus);
  }
  if (updates.paystackPlanCodePro) {
    put(BILLING_SETTING_KEYS.paystackPlanCodePro, updates.paystackPlanCodePro);
  }
  if (updates.paystackAmountCreditsMinor != null) {
    put(
      BILLING_SETTING_KEYS.paystackAmountCreditsMinor,
      String(updates.paystackAmountCreditsMinor),
    );
  }
  if (updates.allowanceFree != null) {
    put(BILLING_SETTING_KEYS.allowanceFree, String(updates.allowanceFree));
  }
  if (updates.allowancePlus != null) {
    put(BILLING_SETTING_KEYS.allowancePlus, String(updates.allowancePlus));
  }
  if (updates.allowancePro != null) {
    put(BILLING_SETTING_KEYS.allowancePro, String(updates.allowancePro));
  }
  if (updates.creditsPackSize != null) {
    put(BILLING_SETTING_KEYS.creditsPackSize, String(updates.creditsPackSize));
  }

  if (ops.length === 0) {
    return NextResponse.json({ ok: true, changed: false });
  }

  try {
    await Promise.all(ops);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to persist settings.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
  return NextResponse.json({ ok: true, changed: true });
}
