import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { sendEmailVerification } from "@/lib/email-verification";

export const runtime = "nodejs";

const bodySchema = z.object({
  email: z.string().email(),
});

export async function POST(req: Request) {
  const raw = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ ok: true });
  }

  const email = parsed.data.email.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, emailVerified: true, passwordHash: true },
  });

  if (user && !user.emailVerified && user.passwordHash) {
    await sendEmailVerification(email);
  }

  // Non-enumerating response.
  return NextResponse.json({ ok: true });
}

