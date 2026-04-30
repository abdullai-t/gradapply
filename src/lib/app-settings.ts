import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

import { prisma } from "@/lib/prisma";

const SECRET_PREFIX = "enc:v1";
const settingsCache = new Map<string, { value: string; expiresAt: number }>();
const CACHE_TTL_MS = 20_000;

export const BILLING_SETTING_KEYS = {
  stripeSecretKey: "billing.stripeSecretKey",
  stripeWebhookSecret: "billing.stripeWebhookSecret",
  stripePricePlus: "billing.stripePricePlus",
  stripePricePro: "billing.stripePricePro",
  stripePriceProRenewal: "billing.stripePriceProRenewal",
  stripePricePlusRenewal: "billing.stripePricePlusRenewal",
  stripePriceCreditsPack: "billing.stripePriceCreditsPack",
  stripePriceCvDeepReview: "billing.stripePriceCvDeepReview",
  stripePriceSopDetailedCritique: "billing.stripePriceSopDetailedCritique",
  paystackSecretKey: "billing.paystackSecretKey",
  paystackCurrency: "billing.paystackCurrency",
  paystackPlanCodePlus: "billing.paystackPlanCodePlus",
  paystackPlanCodePro: "billing.paystackPlanCodePro",
  paystackPlanCodeProRenewal: "billing.paystackPlanCodeProRenewal",
  paystackPlanCodePlusRenewal: "billing.paystackPlanCodePlusRenewal",
  paystackAmountCreditsMinor: "billing.paystackAmountCreditsMinor",
  displayPriceProGhs: "billing.displayPriceProGhs",
  displayPricePlusGhs: "billing.displayPricePlusGhs",
  displayPriceCreditsPackGhs: "billing.displayPriceCreditsPackGhs",
  creditUnitPriceGhs: "billing.creditUnitPriceGhs",
  displayPriceProRenewalGhs: "billing.displayPriceProRenewalGhs",
  displayPricePlusRenewalGhs: "billing.displayPricePlusRenewalGhs",
  paystackAmountCvDeepReviewMinor: "billing.paystackAmountCvDeepReviewMinor",
  paystackAmountSopDetailedCritiqueMinor: "billing.paystackAmountSopDetailedCritiqueMinor",
  allowanceFree: "billing.allowanceFree",
  allowancePlus: "billing.allowancePlus",
  allowancePro: "billing.allowancePro",
  freeSignupCredits: "billing.freeSignupCredits",
  freeMonthlyCreditsGrant: "billing.freeMonthlyCreditsGrant",
  creditsPackSize: "billing.creditsPackSize",
} as const;

function appSecret(): string {
  const secret =
    process.env.AUTH_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim() || "";
  if (secret) return secret;
  if (process.env.NODE_ENV !== "production") {
    // Dev fallback so local admin settings are usable without auth env wiring.
    return "gradapply-dev-app-settings-secret";
  }
  throw new Error("AUTH_SECRET or NEXTAUTH_SECRET is required");
}

function encryptionKey(): Buffer {
  return createHash("sha256").update(appSecret()).digest();
}

function encryptValue(plain: string): string {
  const key = encryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plain, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${SECRET_PREFIX}:${iv.toString("base64url")}:${tag.toString(
    "base64url",
  )}:${encrypted.toString("base64url")}`;
}

function decryptValue(value: string): string {
  if (!value.startsWith(`${SECRET_PREFIX}:`)) {
    return value;
  }
  const [, , ivB64, tagB64, dataB64] = value.split(":");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Invalid encrypted setting format");
  }
  const key = encryptionKey();
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(ivB64, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64url")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

export function clearAppSettingCache(key?: string): void {
  if (key) {
    settingsCache.delete(key);
    return;
  }
  settingsCache.clear();
}

export async function getAppSettingValue(
  key: string,
  fallback?: string,
): Promise<string | undefined> {
  const now = Date.now();
  const cached = settingsCache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.value || fallback;
  }

  const row = await prisma.appSetting.findUnique({ where: { key } });
  if (!row) return fallback;

  let plain: string;
  try {
    plain = row.isSecret ? decryptValue(row.value) : row.value;
  } catch (error) {
    console.warn("[app-settings] failed to decrypt setting", {
      key,
      reason: error instanceof Error ? error.message : "unknown_error",
    });
    return fallback;
  }
  settingsCache.set(key, { value: plain, expiresAt: now + CACHE_TTL_MS });
  return plain || fallback;
}

export async function setAppSettingValue(args: {
  key: string;
  value: string;
  secret?: boolean;
}): Promise<void> {
  const value = args.value.trim();
  const isSecret = Boolean(args.secret);
  const storedValue = isSecret ? encryptValue(value) : value;
  await prisma.appSetting.upsert({
    where: { key: args.key },
    update: {
      value: storedValue,
      isSecret,
    },
    create: {
      key: args.key,
      value: storedValue,
      isSecret,
    },
  });
  clearAppSettingCache(args.key);
}

export async function listAppSettings(prefix: string): Promise<
  Array<{
    key: string;
    value: string;
    isSecret: boolean;
    updatedAt: Date;
  }>
> {
  const rows = await prisma.appSetting.findMany({
    where: { key: { startsWith: prefix } },
    orderBy: { key: "asc" },
  });
  return rows.map((row) => ({
    key: row.key,
    value: (() => {
      if (!row.isSecret) return row.value;
      try {
        return decryptValue(row.value);
      } catch (error) {
        console.warn("[app-settings] failed to decrypt setting in list", {
          key: row.key,
          reason: error instanceof Error ? error.message : "unknown_error",
        });
        return "";
      }
    })(),
    isSecret: row.isSecret,
    updatedAt: row.updatedAt,
  }));
}
