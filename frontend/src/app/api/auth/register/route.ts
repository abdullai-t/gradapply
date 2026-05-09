import { NextResponse } from "next/server";
import { z } from "zod";

import { hashPassword } from "@/lib/password";
import { getBillingAdminConfig } from "@/lib/billing-admin-config";
import { currentBillingMonthToken } from "@/lib/billing-allowance";
import { sendEmailVerification } from "@/lib/email-verification";
import { prisma } from "@/lib/prisma";
import {
  assertRegisterAllowedByIp,
  getClientIpFromRequest,
} from "@/lib/upstash-rate-limit";

export const runtime = "nodejs";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().trim().min(1).max(120).optional(),
});

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = registerSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const clientIp = getClientIpFromRequest(req);
  const registerCap = await assertRegisterAllowedByIp(clientIp);
  if (!registerCap.ok) {
    return NextResponse.json(
      {
        error:
          "Too many registration attempts from this network. Try again later.",
      },
      {
        status: 429,
        headers: { RetryAfter: String(registerCap.retryAfterSec) },
      },
    );
  }

  const { email: rawEmail, password, name } = parsed.data;
  const email = rawEmail.toLowerCase().trim();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      {
        error:
          "An account with this email already exists. Sign in or reset your password.",
      },
      { status: 409 },
    );
  }

  const passwordHash = await hashPassword(password);
  const billingCfg = await getBillingAdminConfig();

  await prisma.user.create({
    data: {
      email,
      passwordHash,
      name: name ?? null,
      emailVerified: null,
      aiCreditsBalance: billingCfg.freeSignupCredits,
      aiUsageMonth: currentBillingMonthToken(),
    },
  });

  const verificationSent = await sendEmailVerification(email);

  return NextResponse.json({ ok: true, verificationSent });
}
