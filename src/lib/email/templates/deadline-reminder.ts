import { appOrigin } from "@/lib/app-origin";

import {
  buildEmailLayout,
  detailRowHtml,
  paragraphHtml,
  type EmailContent,
} from "@/lib/email/layout";

export function buildDeadline30DayEmail(opts: {
  schoolName: string;
  program: string;
  deadlineLabel: string;
  schoolId: string;
  reminderNote?: string | null;
}): EmailContent {
  const origin = appOrigin();
  const schoolUrl = `${origin}/schools/${opts.schoolId}`;
  const subject = `30 days until deadline — ${opts.schoolName}`;
  const textLines = [
    `Your application deadline for ${opts.schoolName} (${opts.program}) is in 30 days.`,
    `Deadline: ${opts.deadlineLabel}`,
  ];
  if (opts.reminderNote?.trim()) {
    textLines.push(`Reminder note: ${opts.reminderNote.trim()}`);
  }
  textLines.push("", `Open school: ${schoolUrl}`);
  const text = textLines.join("\n");

  let bodyHtml =
    paragraphHtml(
      `Your application deadline for ${opts.schoolName} is coming up in 30 days. This is a good time to review materials, letters, and your statement of purpose.`,
    ) +
    detailRowHtml("Program", opts.program) +
    detailRowHtml("Deadline", opts.deadlineLabel);
  if (opts.reminderNote?.trim()) {
    bodyHtml += detailRowHtml("Your reminder", opts.reminderNote.trim());
  }

  const html = buildEmailLayout({
    preheader: `30 days left for ${opts.schoolName}`,
    title: "Application deadline in 30 days",
    bodyHtml,
    cta: { label: "View school", href: schoolUrl },
  });

  return { subject, text, html };
}

export function buildSchoolReminderEmail(opts: {
  schoolName: string;
  program: string;
  reminderLabel: string;
  schoolId: string;
  reminderNote?: string | null;
}): EmailContent {
  const origin = appOrigin();
  const schoolUrl = `${origin}/schools/${opts.schoolId}`;
  const subject = `Reminder — ${opts.schoolName}`;
  const textLines = [
    `Reminder for ${opts.schoolName} (${opts.program}).`,
    `Date: ${opts.reminderLabel}`,
  ];
  if (opts.reminderNote?.trim()) {
    textLines.push(opts.reminderNote.trim());
  }
  textLines.push("", `Open school: ${schoolUrl}`);
  const text = textLines.join("\n");

  let bodyHtml =
    paragraphHtml(`This is your scheduled reminder for ${opts.schoolName}.`) +
    detailRowHtml("Program", opts.program) +
    detailRowHtml("Reminder date", opts.reminderLabel);
  if (opts.reminderNote?.trim()) {
    bodyHtml += detailRowHtml("Note", opts.reminderNote.trim());
  }

  const html = buildEmailLayout({
    preheader: `Reminder for ${opts.schoolName}`,
    title: "Application reminder",
    bodyHtml,
    cta: { label: "View school", href: schoolUrl },
  });

  return { subject, text, html };
}

export function buildSchoolCombinedNotifyEmail(opts: {
  schoolName: string;
  program: string;
  deadlineLabel: string;
  reminderLabel: string;
  schoolId: string;
  reminderNote?: string | null;
}): EmailContent {
  const origin = appOrigin();
  const schoolUrl = `${origin}/schools/${opts.schoolId}`;
  const subject = `Updates for ${opts.schoolName} — deadline & reminder`;
  const text = [
    `${opts.schoolName} (${opts.program})`,
    `30-day deadline notice: ${opts.deadlineLabel}`,
    `Scheduled reminder: ${opts.reminderLabel}`,
    opts.reminderNote?.trim() ? `Note: ${opts.reminderNote.trim()}` : "",
    "",
    `Open school: ${schoolUrl}`,
  ]
    .filter(Boolean)
    .join("\n");

  let bodyHtml = paragraphHtml(
    `You have two updates for ${opts.schoolName} today:`,
  );
  bodyHtml += detailRowHtml("Program", opts.program);
  bodyHtml += detailRowHtml("Deadline (30 days away)", opts.deadlineLabel);
  bodyHtml += detailRowHtml("Reminder date", opts.reminderLabel);
  if (opts.reminderNote?.trim()) {
    bodyHtml += detailRowHtml("Reminder note", opts.reminderNote.trim());
  }

  const html = buildEmailLayout({
    preheader: `Deadline and reminder for ${opts.schoolName}`,
    title: "School deadline & reminder",
    bodyHtml,
    cta: { label: "View school", href: schoolUrl },
  });

  return { subject, text, html };
}
