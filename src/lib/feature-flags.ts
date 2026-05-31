import { prisma } from "@/lib/prisma";

export type KnownFeatureFlagKey =
  | "collaboration"
  | "homepage_pricing_section"
  | "support_tab";

function envOverride(key: KnownFeatureFlagKey): boolean | null {
  const envKey = `FEATURE_FLAG_${key.toUpperCase()}`;
  const raw = process.env[envKey]?.trim().toLowerCase();
  if (raw === "true" || raw === "1") return true;
  if (raw === "false" || raw === "0") return false;
  return null;
}

export async function isFeatureFlagEnabled(
  key: KnownFeatureFlagKey,
): Promise<boolean> {
  const override = envOverride(key);
  if (override !== null) return override;

  const row = await prisma.featureFlag.findUnique({
    where: { key },
    select: { enabled: true },
  });
  if (!row) {
    return key === "collaboration" && process.env.NODE_ENV === "development";
  }
  return row.enabled;
}
