import type { NotificationType, PlanTier, School } from "@prisma/client";

import { buildCreditsPurchasedEmail } from "@/lib/email/templates/credits-purchased";
import {
  buildDeadline30DayEmail,
  buildSchoolCombinedNotifyEmail,
  buildSchoolReminderEmail,
} from "@/lib/email/templates/deadline-reminder";
import { buildPlanSubscriptionEmail } from "@/lib/email/templates/subscription";
import { buildWelcomeEmail } from "@/lib/email/templates/welcome";
import type { EmailContent } from "@/lib/email/layout";
import { isMailConfigured, sendMail } from "@/lib/mail";
import { prisma } from "@/lib/prisma";
import { log } from "@/lib/logger";

import {
  formatDateForEmail,
  resolveUserTimezone,
} from "./deadline-schedule";

export type NotificationRecipient = {
  id: string;
  email: string | null;
  name: string | null;
};

export type SendNotificationResult =
  | { status: "sent" }
  | { status: "skipped"; reason: string }
  | { status: "failed"; error: string };

export async function sendNotification(opts: {
  userId: string;
  type: NotificationType;
  dedupeKey: string;
  to: string;
  content: EmailContent;
}): Promise<SendNotificationResult> {
  if (!isMailConfigured()) {
    return { status: "skipped", reason: "mail_not_configured" };
  }

  const existing = await prisma.notificationLog.findUnique({
    where: { dedupeKey: opts.dedupeKey },
    select: { id: true },
  });
  if (existing) {
    return { status: "skipped", reason: "already_sent" };
  }

  const result = await sendMail({
    to: opts.to,
    subject: opts.content.subject,
    text: opts.content.text,
    html: opts.content.html,
  });

  if (!result.sent) {
    return {
      status: "failed",
      error: result.error ?? "send_failed",
    };
  }

  try {
    await prisma.notificationLog.create({
      data: {
        userId: opts.userId,
        type: opts.type,
        dedupeKey: opts.dedupeKey,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("Unique constraint")) {
      return { status: "skipped", reason: "already_sent" };
    }
    log.warn("notification.log_insert_failed", {
      userId: opts.userId,
      dedupeKey: opts.dedupeKey,
      error: message,
    });
  }

  if (result.previewUrl && process.env.NODE_ENV === "development") {
    console.info("[mail] notification preview:", result.previewUrl);
  }

  return { status: "sent" };
}

export async function sendWelcomeEmail(
  user: NotificationRecipient,
): Promise<SendNotificationResult> {
  if (!user.email?.trim()) {
    return { status: "skipped", reason: "no_email" };
  }

  const content = buildWelcomeEmail({ name: user.name });
  return sendNotification({
    userId: user.id,
    type: "WELCOME",
    dedupeKey: `welcome:${user.id}`,
    to: user.email.trim().toLowerCase(),
    content,
  });
}

type SchoolForNotify = Pick<
  School,
  "id" | "name" | "program" | "deadline" | "reminderAt" | "reminderNote"
>;

export async function sendSchoolScheduledEmail(opts: {
  user: NotificationRecipient;
  school: SchoolForNotify;
  timezone: string;
  sendDeadline30d: boolean;
  sendReminderToday: boolean;
  localToday: string;
}): Promise<SendNotificationResult> {
  if (!opts.user.email?.trim()) {
    return { status: "skipped", reason: "no_email" };
  }

  const tz = resolveUserTimezone(opts.timezone);
  const dedupeKey = `school_notify:${opts.school.id}:${opts.localToday}`;

  let content: EmailContent;
  let type: NotificationType;

  if (opts.sendDeadline30d && opts.sendReminderToday && opts.school.deadline && opts.school.reminderAt) {
    content = buildSchoolCombinedNotifyEmail({
      schoolName: opts.school.name,
      program: opts.school.program,
      deadlineLabel: formatDateForEmail(opts.school.deadline, tz),
      reminderLabel: formatDateForEmail(opts.school.reminderAt, tz),
      schoolId: opts.school.id,
      reminderNote: opts.school.reminderNote,
    });
    type = "SCHOOL_COMBINED";
  } else if (opts.sendDeadline30d && opts.school.deadline) {
    content = buildDeadline30DayEmail({
      schoolName: opts.school.name,
      program: opts.school.program,
      deadlineLabel: formatDateForEmail(opts.school.deadline, tz),
      schoolId: opts.school.id,
      reminderNote: opts.sendReminderToday ? opts.school.reminderNote : null,
    });
    type = "DEADLINE_30D";
  } else if (opts.sendReminderToday && opts.school.reminderAt) {
    content = buildSchoolReminderEmail({
      schoolName: opts.school.name,
      program: opts.school.program,
      reminderLabel: formatDateForEmail(opts.school.reminderAt, tz),
      schoolId: opts.school.id,
      reminderNote: opts.school.reminderNote,
    });
    type = "REMINDER";
  } else {
    return { status: "skipped", reason: "nothing_to_send" };
  }

  return sendNotification({
    userId: opts.user.id,
    type,
    dedupeKey,
    to: opts.user.email.trim().toLowerCase(),
    content,
  });
}

export async function sendPlanSubscriptionEmail(opts: {
  user: NotificationRecipient;
  tier: Extract<PlanTier, "PLUS" | "PRO">;
  paystackReference: string;
  periodEnd?: Date | null;
  timezone?: string | null;
}): Promise<SendNotificationResult> {
  if (!opts.user.email?.trim()) {
    return { status: "skipped", reason: "no_email" };
  }

  const tz = resolveUserTimezone(opts.timezone);
  const periodEndLabel = opts.periodEnd
    ? formatDateForEmail(opts.periodEnd, tz)
    : null;

  const content = buildPlanSubscriptionEmail({
    tier: opts.tier,
    periodEndLabel,
    name: opts.user.name,
  });

  const type = opts.tier === "PRO" ? "PLAN_PRO" : "PLAN_PLUS";
  const dedupeKey = `${type.toLowerCase()}:${opts.paystackReference}`;

  return sendNotification({
    userId: opts.user.id,
    type,
    dedupeKey,
    to: opts.user.email.trim().toLowerCase(),
    content,
  });
}

export async function sendCreditsPurchasedEmail(opts: {
  user: NotificationRecipient;
  paystackReference: string;
  creditsAdded: number;
  balanceAfter?: number | null;
}): Promise<SendNotificationResult> {
  if (!opts.user.email?.trim()) {
    return { status: "skipped", reason: "no_email" };
  }

  const content = buildCreditsPurchasedEmail({
    creditsAdded: opts.creditsAdded,
    balanceAfter: opts.balanceAfter,
    name: opts.user.name,
  });

  return sendNotification({
    userId: opts.user.id,
    type: "CREDITS_PURCHASE",
    dedupeKey: `credits:${opts.paystackReference}`,
    to: opts.user.email.trim().toLowerCase(),
    content,
  });
}

/** Fire-and-forget helper for API handlers — errors are logged, not thrown. */
export function notifyInBackground(
  label: string,
  task: () => Promise<SendNotificationResult>,
): void {
  void task().then((result) => {
    if (result.status === "failed") {
      log.warn(`notification.${label}_failed`, { error: result.error });
    } else if (result.status === "skipped") {
      log.warn(`notification.${label}_skipped`, { reason: result.reason });
    }
  });
}
