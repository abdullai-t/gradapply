import type SMTPTransport from "nodemailer/lib/smtp-transport";

import { sendViaResendApi, verifyResendApi } from "@/lib/mail-resend";

export type MailTransportMode =
  | "email_server"
  | "smtp"
  | "resend"
  | "ethereal_dev"
  | "none";

type NodemailerServer = string | SMTPTransport.Options;

type GlobalMail = typeof globalThis & {
  __gradapplyEthereal?: {
    user: string;
    pass: string;
    smtpHost: string;
    smtpPort: number;
  };
};

const globalMail = globalThis as GlobalMail;

/** Sender used for verification, magic links, and other transactional mail. */
export function mailFromAddress(): string {
  return (
    process.env.EMAIL_FROM?.trim() ||
    process.env.SMTP_FROM?.trim() ||
    process.env.MAIL_FROM?.trim() ||
    "GradApply <no-reply@gradapply.app>"
  );
}

export function getMailTransportMode(): MailTransportMode {
  if (process.env.EMAIL_SERVER?.trim()) return "email_server";
  if (process.env.RESEND_API_KEY?.trim()) return "resend";
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASSWORD?.trim();
  if (host && user && pass) return "smtp";
  if (
    process.env.NODE_ENV !== "production" &&
    process.env.MAIL_DEV_ETHEREAL?.trim() === "true"
  ) {
    return "ethereal_dev";
  }
  return "none";
}

export function isMailConfigured(): boolean {
  return getMailTransportMode() !== "none";
}

function resendSmtpOptions(): SMTPTransport.Options {
  const port = Number(process.env.RESEND_SMTP_PORT ?? "465");
  const secure =
    process.env.RESEND_SMTP_SECURE?.trim() === "false" ? false : port === 465;
  return {
    host: "smtp.resend.com",
    port,
    secure,
    auth: {
      user: "resend",
      pass: process.env.RESEND_API_KEY!.trim(),
    },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    requireTLS: !secure,
  };
}

/** Options for Auth.js `Nodemailer` provider (magic link sign-in). */
export function getNodemailerProviderOptions(): {
  server: NodemailerServer;
  from: string;
} | null {
  const mode = getMailTransportMode();
  if (mode === "none") return null;

  const from = mailFromAddress();
  if (mode === "email_server") {
    return { server: process.env.EMAIL_SERVER!.trim(), from };
  }
  if (mode === "resend") {
    return { server: resendSmtpOptions(), from };
  }
  if (mode === "smtp") {
    return {
      server: {
        host: process.env.SMTP_HOST!.trim(),
        port: Number(process.env.SMTP_PORT ?? "587"),
        secure: process.env.SMTP_SECURE?.trim() === "true",
        auth: {
          user: process.env.SMTP_USER!.trim(),
          pass: process.env.SMTP_PASSWORD!.trim(),
        },
      },
      from,
    };
  }
  // ethereal_dev — resolved async in createMailTransporter; provider needs sync config.
  return null;
}

async function ensureEtherealAccount(): Promise<NonNullable<GlobalMail["__gradapplyEthereal"]>> {
  if (globalMail.__gradapplyEthereal) return globalMail.__gradapplyEthereal;
  const nodemailer = await import("nodemailer");
  const account = await nodemailer.createTestAccount();
  globalMail.__gradapplyEthereal = {
    user: account.user,
    pass: account.pass,
    smtpHost: account.smtp.host,
    smtpPort: account.smtp.port,
  };
  return globalMail.__gradapplyEthereal;
}

export async function createMailTransporter() {
  const mode = getMailTransportMode();
  if (mode === "none") return null;

  const nodemailer = await import("nodemailer");

  if (mode === "email_server") {
    return nodemailer.createTransport(process.env.EMAIL_SERVER!.trim());
  }

  if (mode === "resend") {
    return nodemailer.createTransport(resendSmtpOptions());
  }

  if (mode === "smtp") {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST!.trim(),
      port: Number(process.env.SMTP_PORT ?? "587"),
      secure: process.env.SMTP_SECURE?.trim() === "true",
      auth: {
        user: process.env.SMTP_USER!.trim(),
        pass: process.env.SMTP_PASSWORD!.trim(),
      },
    });
  }

  const ethereal = await ensureEtherealAccount();
  return nodemailer.createTransport({
    host: ethereal.smtpHost,
    port: ethereal.smtpPort,
    secure: false,
    auth: {
      user: ethereal.user,
      pass: ethereal.pass,
    },
  });
}

export async function verifyMailTransport(): Promise<{
  ok: boolean;
  mode: MailTransportMode;
  error?: string;
  preview?: string;
}> {
  const mode = getMailTransportMode();
  if (mode === "none") {
    return {
      ok: false,
      mode,
      error:
        "No mail transport configured. Set RESEND_API_KEY, EMAIL_SERVER, or SMTP_HOST/SMTP_USER/SMTP_PASSWORD (or MAIL_DEV_ETHEREAL=true in development).",
    };
  }

  try {
    if (mode === "resend") {
      const api = await verifyResendApi();
      if (!api.ok) {
        return { ok: false, mode, error: api.error };
      }
      return { ok: true, mode, preview: api.preview ?? "Resend HTTP API" };
    }

    const transporter = await createMailTransporter();
    if (!transporter) {
      return { ok: false, mode, error: "Could not create mail transporter." };
    }
    await transporter.verify();
    if (mode === "ethereal_dev") {
      const ethereal = await ensureEtherealAccount();
      return {
        ok: true,
        mode,
        preview: `Ethereal dev inbox: ${ethereal.user}`,
      };
    }
    return { ok: true, mode };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, mode, error: message };
  }
}

export async function sendMail(args: {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
}): Promise<{ sent: boolean; error?: string; previewUrl?: string }> {
  const mode = getMailTransportMode();
  if (mode === "none") {
    return {
      sent: false,
      error:
        "Mail is not configured. Set RESEND_API_KEY, EMAIL_SERVER, or SMTP_* in the environment.",
    };
  }

  try {
    if (mode === "resend") {
      return sendViaResendApi(args);
    }

    const transporter = await createMailTransporter();
    if (!transporter) {
      return { sent: false, error: "Could not create mail transporter." };
    }

    const info = await transporter.sendMail({
      from: mailFromAddress(),
      to: args.to,
      subject: args.subject,
      text: args.text,
      html: args.html,
      replyTo: args.replyTo,
    });

    let previewUrl: string | undefined;
    if (mode === "ethereal_dev") {
      const nodemailer = await import("nodemailer");
      const url = nodemailer.getTestMessageUrl(info);
      previewUrl = typeof url === "string" ? url : undefined;
    }

    return { sent: true, previewUrl };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (process.env.NODE_ENV === "development") {
      console.error("[mail] send failed:", message);
    }
    return { sent: false, error: message };
  }
}
