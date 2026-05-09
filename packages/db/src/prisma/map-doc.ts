// @ts-nocheck
/** Map `_id` → `id` for JSON shaped like Prisma documents. */

export function mapLean<T extends Record<string, unknown>>(
  doc: T | null | undefined,
): T | null {
  if (doc == null) return null;
  const o = { ...doc } as Record<string, unknown>;
  if (o._id != null && o.id === undefined) o.id = o._id;
  delete o.__v;
  return o as T;
}

export function mapLeanMany<T extends Record<string, unknown>>(docs: T[]): T[] {
  return docs.map((d) => mapLean(d) as T);
}
