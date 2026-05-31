const pending = new Map<string, ReturnType<typeof setTimeout>>();

export function debounceGoogleDocSync(
  linkId: string,
  fn: () => Promise<void>,
  ms = 5000,
): void {
  const existing = pending.get(linkId);
  if (existing) clearTimeout(existing);
  pending.set(
    linkId,
    setTimeout(() => {
      pending.delete(linkId);
      void fn().catch(() => {
        /* logged in sync */
      });
    }, ms),
  );
}
