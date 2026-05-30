import { appOrigin } from "@/lib/app-origin";

import {
  buildEmailLayout,
  detailRowHtml,
  paragraphHtml,
  type EmailContent,
} from "@/lib/email/layout";

export function buildCreditsPurchasedEmail(opts: {
  creditsAdded: number;
  balanceAfter?: number | null;
  name?: string | null;
}): EmailContent {
  const origin = appOrigin();
  const greeting = opts.name?.trim()
    ? `Hi ${opts.name.trim()},`
    : "Hi there,";
  const subject = "AI credits added to your account";
  const textLines = [
    greeting,
    "",
    `We added ${opts.creditsAdded} AI credits to your GradApply account.`,
  ];
  if (typeof opts.balanceAfter === "number") {
    textLines.push(`Your new balance: ${opts.balanceAfter} credits`);
  }
  textLines.push("", `Open app: ${origin}/dashboard`);
  const text = textLines.join("\n");

  let bodyHtml = paragraphHtml(
    [
      greeting,
      `Your purchase was successful. ${opts.creditsAdded} AI credits have been added to your account.`,
    ].join("\n"),
  );
  bodyHtml += detailRowHtml("Credits added", String(opts.creditsAdded));
  if (typeof opts.balanceAfter === "number") {
    bodyHtml += detailRowHtml("New balance", `${opts.balanceAfter} credits`);
  }

  const html = buildEmailLayout({
    preheader: `${opts.creditsAdded} AI credits added`,
    title: "Credits purchase confirmed",
    bodyHtml,
    cta: { label: "Go to dashboard", href: `${origin}/dashboard` },
  });

  return { subject, text, html };
}
