import { appOrigin } from "@/lib/app-origin";

import {
  buildEmailLayout,
  paragraphHtml,
  type EmailContent,
} from "@/lib/email/layout";

export function buildCollabInviteEmail(opts: {
  ownerName: string;
  sessionTitle: string;
  sessionId: string;
  inviteeName?: string | null;
}): EmailContent {
  const origin = appOrigin();
  const greeting = opts.inviteeName?.trim()
    ? `Hi ${opts.inviteeName.trim()},`
    : "Hi there,";
  const subject = `${opts.ownerName} invited you to review a draft on GradApply`;
  const href = `${origin}/collaboration/${opts.sessionId}`;

  const text = [
    greeting,
    "",
    `${opts.ownerName} shared "${opts.sessionTitle}" for your feedback on GradApply.`,
    "",
    `Open the review session: ${href}`,
    "",
    "You can leave comments on the snapshot. The owner controls when the session closes.",
  ].join("\n");

  const html = buildEmailLayout({
    preheader: "A peer invited you to review their grad application draft.",
    title: "Review invitation",
    bodyHtml: paragraphHtml(
      [
        greeting,
        `${opts.ownerName} shared "${opts.sessionTitle}" for your feedback.`,
        "Open the session to read the snapshot and leave comments.",
      ].join("\n"),
    ),
    cta: { label: "Open review session", href },
  });

  return { subject, text, html };
}
