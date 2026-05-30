import { appOrigin } from "@/lib/app-origin";

import {
  buildEmailLayout,
  detailRowHtml,
  paragraphHtml,
  type EmailContent,
} from "@/lib/email/layout";

export function buildPlanSubscriptionEmail(opts: {
  tier: "PLUS" | "PRO";
  periodEndLabel?: string | null;
  name?: string | null;
}): EmailContent {
  const origin = appOrigin();
  const planName = opts.tier === "PRO" ? "Pro" : "Plus";
  const greeting = opts.name?.trim()
    ? `Hi ${opts.name.trim()},`
    : "Hi there,";
  const subject = `Your GradApply ${planName} plan is active`;
  const textLines = [
    greeting,
    "",
    `Thank you for subscribing to GradApply ${planName}. Your upgraded features are now available.`,
  ];
  if (opts.periodEndLabel) {
    textLines.push(`Current period ends: ${opts.periodEndLabel}`);
  }
  textLines.push("", `Manage billing: ${origin}/settings`);
  const text = textLines.join("\n");

  let bodyHtml = paragraphHtml(
    [
      greeting,
      `Thank you for subscribing to GradApply ${planName}. You now have access to expanded AI usage and premium workspace features.`,
    ].join("\n"),
  );
  bodyHtml += detailRowHtml("Plan", planName);
  if (opts.periodEndLabel) {
    bodyHtml += detailRowHtml("Current period ends", opts.periodEndLabel);
  }

  const html = buildEmailLayout({
    preheader: `${planName} subscription confirmed`,
    title: `${planName} plan activated`,
    bodyHtml,
    cta: { label: "Open settings", href: `${origin}/settings` },
  });

  return { subject, text, html };
}
