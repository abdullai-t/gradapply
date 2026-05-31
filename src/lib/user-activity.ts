import { getPrisma, hasPrismaModel } from "@/lib/prisma";

/** UTC midnight for the given instant. */
export function utcDayStart(date: Date = new Date()): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

/** Record product activity for DAU/WAU (idempotent per user per UTC day). */
export async function touchUserActivity(userId: string): Promise<void> {
  const db = getPrisma();
  if (!hasPrismaModel(db, "userActivityDay", "upsert")) {
    return;
  }
  const activeOn = utcDayStart();
  await db.userActivityDay.upsert({
    where: {
      userId_activeOn: { userId, activeOn },
    },
    create: { userId, activeOn },
    update: {},
  });
}

/** Fire-and-forget activity touch — safe from request handlers. */
export function touchUserActivityAsync(userId: string): void {
  void touchUserActivity(userId).catch(() => {
    // Non-critical; analytics should not block product flows.
  });
}
