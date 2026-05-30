import { appOrigin } from "@/lib/app-origin";

import {
  buildEmailLayout,
  paragraphHtml,
  type EmailContent,
} from "@/lib/email/layout";

export function buildWelcomeEmail(opts: {
  name?: string | null;
}): EmailContent {
  const origin = appOrigin();
  const greeting = opts.name?.trim()
    ? `Hi ${opts.name.trim()},`
    : "Hi there,";
  const subject = "Welcome to GradApply";
  const text = [
    greeting,
    "",
    "Your account is ready. GradApply helps you track schools, deadlines, materials, professor outreach, and your statement of purpose in one place.",
    "",
    `Open your dashboard: ${origin}/dashboard`,
    "",
    "If you did not create this account, you can ignore this message.",
  ].join("\n");

  const html = buildEmailLayout({
    preheader: "Your grad school application workspace is ready.",
    title: "Welcome to GradApply",
    bodyHtml: paragraphHtml(
      [
        greeting,
        "Your account is ready. Track schools, deadlines, application materials, professor outreach, and your statement of purpose — all in one workspace.",
      ].join("\n"),
    ),
    cta: { label: "Go to dashboard", href: `${origin}/dashboard` },
  });

  return { subject, text, html };
}
