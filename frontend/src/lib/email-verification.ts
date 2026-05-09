import { randomBytes, createHash } from "node:crypto";

import { prisma } from "@/lib/prisma";
import { appOrigin } from "@/lib/app-origin";

const EMAIL_VERIFY_TTL_MS = 1000 * 60 * 60 * 24; // 24h

function verificationSender(): string {
  return (
    process.env.EMAIL_FROM?.trim() ||
    process.env.SMTP_FROM?.trim() ||
    "no-reply@gradapply.app"
  );
}

async function sendEmail(args: { to: string; subject: string; text: string }) {
  const emailServer = process.env.EMAIL_SERVER?.trim();
  const smtpHost = process.env.SMTP_HOST?.trim();
  const smtpUser = process.env.SMTP_USER?.trim();
  const smtpPassword = process.env.SMTP_PASSWORD?.trim();

  if (!emailServer && !(smtpHost && smtpUser && smtpPassword)) {
    return false;
  }

  const nodemailer = await import("nodemailer");
  const transporter = emailServer
    ? nodemailer.createTransport(emailServer)
    : nodemailer.createTransport({
        host: smtpHost,
        port: Number(process.env.SMTP_PORT ?? "587"),
        auth: {
          user: smtpUser,
          pass: smtpPassword,
        },
      });

  await transporter.sendMail({
    from: verificationSender(),
    to: args.to,
    subject: args.subject,
    text: args.text,
  });
  return true;
}

export async function issueEmailVerificationToken(email: string): Promise<string> {
  const normalized = email.trim().toLowerCase();
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expires = new Date(Date.now() + EMAIL_VERIFY_TTL_MS);

  await prisma.verificationToken.deleteMany({
    where: { identifier: normalized },
  });
  await prisma.verificationToken.create({
    data: {
      identifier: normalized,
      token: tokenHash,
      expires,
    },
  });

  return token;
}

export async function sendEmailVerification(email: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  const token = await issueEmailVerificationToken(normalized);
  const verifyUrl = `${appOrigin()}/api/auth/verify-email?token=${encodeURIComponent(token)}`;
  const body =
    `Confirm your GradApply email address.\n\n` +
    `Open this link to verify your account:\n${verifyUrl}\n\n` +
    `If you didn't create this account, you can ignore this email.`;

  return sendEmail({
    to: normalized,
    subject: "Verify your GradApply email",
    text: body,
  });
}

export async function consumeEmailVerificationToken(token: string): Promise<boolean> {
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const row = await prisma.verificationToken.findUnique({
    where: { token: tokenHash },
  });
  if (!row || row.expires.getTime() < Date.now()) return false;

  await prisma.$transaction([
    prisma.user.updateMany({
      where: {
        email: row.identifier,
        emailVerified: null,
      },
      data: { emailVerified: new Date() },
    }),
    prisma.verificationToken.deleteMany({
      where: { identifier: row.identifier },
    }),
  ]);
  return true;
}

