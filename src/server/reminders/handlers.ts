import { prisma } from "@/lib/prisma";

import { ok } from "../_responses";
import { withAuth } from "../_with-auth";

/** Schools with a scheduled reminder (`reminderAt` set), ordered soonest first. */
export const GET = withAuth(async (_req, { userId }) => {
  const reminders = await prisma.school.findMany({
    where: { userId, reminderAt: { not: null } },
    orderBy: [{ reminderAt: "asc" }, { name: "asc" }],
  });

  return ok(reminders);
});
