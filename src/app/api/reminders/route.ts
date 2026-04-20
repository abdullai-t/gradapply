import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/** Schools with a scheduled reminder (`reminderAt` set), ordered soonest first. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const reminders = await prisma.school.findMany({
    where: { userId: session.user.id, reminderAt: { not: null } },
    orderBy: [{ reminderAt: "asc" }, { name: "asc" }],
  });

  return NextResponse.json(reminders);
}
