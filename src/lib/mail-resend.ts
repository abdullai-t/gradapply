import { Resend } from "resend";

import { mailFromAddress } from "@/lib/mail";

function resendApiKey(): string | null {
  const key = process.env.RESEND_API_KEY?.trim();
  return key || null;
}

/** Lightweight check before send (avoids SMTP; full auth happens on send). */
export async function verifyResendApi(): Promise<{
  ok: boolean;
  error?: string;
  preview?: string;
}> {
  const key = resendApiKey();
  if (!key) {
    return { ok: false, error: "RESEND_API_KEY is not set." };
  }
  if (!/^re_[A-Za-z0-9_]+$/.test(key)) {
    return { ok: false, error: "RESEND_API_KEY format looks invalid." };
  }

  try {
    const res = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (res.status === 401) {
      return {
        ok: false,
        error:
          "Resend rejected the API key (401). Create a new key at https://resend.com/api-keys",
      };
    }
    if (res.ok) {
      return { ok: true, preview: "Resend HTTP API (key verified)" };
    }
    return { ok: true, preview: "Resend HTTP API (send will confirm key)" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: true, preview: `Resend HTTP API (offline check skipped: ${message})` };
  }
}

export async function sendViaResendApi(args: {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
}): Promise<{ sent: boolean; error?: string }> {
  const key = resendApiKey();
  if (!key) {
    return { sent: false, error: "RESEND_API_KEY is not set." };
  }

  const resend = new Resend(key);
  const { error } = await resend.emails.send({
    from: mailFromAddress(),
    to: [args.to],
    subject: args.subject,
    text: args.text,
    html: args.html,
    replyTo: args.replyTo,
  });

  if (error) {
    return {
      sent: false,
      error: error.message ?? "Resend API send failed.",
    };
  }

  return { sent: true };
}
