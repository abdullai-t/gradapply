// @ts-nocheck
import { z } from "zod";
import { hashPassword } from "@/lib/password";
import { getBillingAdminConfig } from "@/lib/billing-admin-config";
import { currentBillingMonthToken } from "@/lib/billing-allowance";
import { consumeEmailVerificationToken, sendEmailVerification, } from "@/lib/email-verification";
import { prisma } from "@/lib/prisma";
import { assertRegisterAllowedByIp, getClientIpFromRequest, } from "@/lib/upstash-rate-limit";
import { appOrigin } from "@/lib/app-origin";
const registerSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8).max(128),
    name: z.string().trim().min(1).max(120).optional(),
});
/** POST /api/auth/register */
export async function authRegisterPost(req) {
    let json;
    try {
        json = await req.json();
    }
    catch {
        return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const parsed = registerSchema.safeParse(json);
    if (!parsed.success) {
        return Response.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
    }
    const clientIp = getClientIpFromRequest(req);
    const registerCap = await assertRegisterAllowedByIp(clientIp);
    if (!registerCap.ok) {
        return Response.json({
            error: "Too many registration attempts from this network. Try again later.",
        }, {
            status: 429,
            headers: { RetryAfter: String(registerCap.retryAfterSec) },
        });
    }
    const { email: rawEmail, password, name } = parsed.data;
    const email = rawEmail.toLowerCase().trim();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
        return Response.json({
            error: "An account with this email already exists. Sign in or reset your password.",
        }, { status: 409 });
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
    return Response.json({ ok: true, verificationSent });
}
/** GET /api/auth/verify-email */
export async function authVerifyEmailGet(req) {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token")?.trim() ?? "";
    const base = appOrigin();
    if (!token) {
        return Response.redirect(`${base}/login?verify_error=1`);
    }
    const ok = await consumeEmailVerificationToken(token);
    return Response.redirect(ok ? `${base}/login?verified=1` : `${base}/login?verify_error=1`);
}
const resendBodySchema = z.object({
    email: z.string().email(),
});
/** POST /api/auth/verify-email/resend */
export async function authVerifyEmailResendPost(req) {
    const raw = await req.json().catch(() => null);
    const parsed = resendBodySchema.safeParse(raw);
    if (!parsed.success) {
        return Response.json({ ok: true });
    }
    const email = parsed.data.email.trim().toLowerCase();
    const user = await prisma.user.findUnique({
        where: { email },
        select: { id: true, emailVerified: true, passwordHash: true },
    });
    if (user && !user.emailVerified && user.passwordHash) {
        await sendEmailVerification(email);
    }
    return Response.json({ ok: true });
}
