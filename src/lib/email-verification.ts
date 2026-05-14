import { randomBytes, createHash } from "node:crypto";

import { appOrigin } from "@/lib/app-origin";
import { sendMail } from "@/lib/mail";
import { prisma } from "@/lib/prisma";

const EMAIL_VERIFY_TTL_MS = 1000 * 60 * 60 * 24; // 24h

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

  const result = await sendMail({
    to: normalized,
    subject: "Verify your GradApply email",
    text: body,
  });

  if (result.previewUrl && process.env.NODE_ENV === "development") {
    console.info("[mail] verification preview:", result.previewUrl);
  }

  return result.sent;
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
