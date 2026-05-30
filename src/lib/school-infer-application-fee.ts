/** Normalize LLM / import values into a display-ready application fee string. */
export function normalizeApplicationFeeValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" && !Number.isNaN(value)) {
    if (value === 0) return "$0";
    return Number.isInteger(value) ? `$${value}` : `$${value.toFixed(2)}`;
  }
  const s = String(value).trim();
  if (!s) return null;
  if (/^(none|n\/a|na|unknown|null)$/i.test(s)) return null;
  if (/^waived/i.test(s) || /no fee/i.test(s)) return s;
  if (/^\d+(\.\d{1,2})?$/.test(s)) return `$${s}`;
  return s;
}

const APPLICATION_FEE_KEYS = [
  "applicationFee",
  "application_fee",
  "application fee",
  "appFee",
  "app_fee",
  "applicationFeeAmount",
  "graduateApplicationFee",
] as const;

/** Read application fee from infer JSON (supports common key aliases). */
export function pickInferApplicationFee(
  fields: Record<string, unknown>,
): string | null {
  for (const key of APPLICATION_FEE_KEYS) {
    if (!(key in fields)) continue;
    const normalized = normalizeApplicationFeeValue(fields[key]);
    if (normalized) return normalized;
  }
  return null;
}
