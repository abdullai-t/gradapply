/**
 * Product support email shown on `/support` and nav when configured.
 * Set `NEXT_PUBLIC_SUPPORT_EMAIL` (Vercel env, rebuild after change).
 */
export function getSupportEmail(): string | null {
  const raw = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim();
  return raw || null;
}
