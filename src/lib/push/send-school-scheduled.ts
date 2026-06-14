import type { NotificationType, School } from "@prisma/client";

import { appOrigin } from "@/lib/app-origin";
import { prisma } from "@/lib/prisma";
import { log } from "@/lib/logger";

import { formatDateForEmail, resolveUserTimezone } from "@/lib/notifications/deadline-schedule";
import type { SendNotificationResult } from "@/lib/notifications/send";

import { isFcmConfigured, sendFcmMessage } from "./fcm-client";
import { pruneStalePushTokens } from "./prune-stale-tokens";

type SchoolForNotify = Pick<
  School,
  "id" | "name" | "program" | "deadline" | "reminderAt" | "reminderNote"
>;

type PushContent = {
  title: string;
  body: string;
  type: NotificationType;
};

export function buildSchoolScheduledPushContent(opts: {
  school: SchoolForNotify;
  timezone: string;
  sendDeadline30d: boolean;
  sendReminderToday: boolean;
}): PushContent | null {
  const tz = resolveUserTimezone(opts.timezone);

  if (
    opts.sendDeadline30d &&
    opts.sendReminderToday &&
    opts.school.deadline &&
    opts.school.reminderAt
  ) {
    return {
      type: "SCHOOL_COMBINED",
      title: `${opts.school.name}: deadline & reminder today`,
      body: `Deadline ${formatDateForEmail(opts.school.deadline, tz)} · Reminder ${formatDateForEmail(opts.school.reminderAt, tz)}`,
    };
  }

  if (opts.sendDeadline30d && opts.school.deadline) {
    return {
      type: "DEADLINE_30D",
      title: `30 days until deadline — ${opts.school.name}`,
      body: `${opts.school.program} · ${formatDateForEmail(opts.school.deadline, tz)}`,
    };
  }

  if (opts.sendReminderToday && opts.school.reminderAt) {
    const note = opts.school.reminderNote?.trim();
    return {
      type: "REMINDER",
      title: `Reminder — ${opts.school.name}`,
      body: note
        ? note
        : `${opts.school.program} · ${formatDateForEmail(opts.school.reminderAt, tz)}`,
    };
  }

  return null;
}

export function schoolPushDedupeKey(schoolId: string, localToday: string): string {
  return `school_notify:${schoolId}:${localToday}:push`;
}

export async function sendSchoolScheduledPush(opts: {
  userId: string;
  pushEnabled: boolean;
  tokens: Array<{ id: string; token: string }>;
  school: SchoolForNotify;
  timezone: string;
  sendDeadline30d: boolean;
  sendReminderToday: boolean;
  localToday: string;
}): Promise<SendNotificationResult> {
  if (!opts.pushEnabled || opts.tokens.length === 0) {
    return { status: "skipped", reason: "push_not_enabled" };
  }
  if (!isFcmConfigured()) {
    return { status: "skipped", reason: "fcm_not_configured" };
  }

  const content = buildSchoolScheduledPushContent({
    school: opts.school,
    timezone: opts.timezone,
    sendDeadline30d: opts.sendDeadline30d,
    sendReminderToday: opts.sendReminderToday,
  });
  if (!content) {
    return { status: "skipped", reason: "nothing_to_send" };
  }

  const dedupeKey = schoolPushDedupeKey(opts.school.id, opts.localToday);
  const existing = await prisma.notificationLog.findUnique({
    where: { dedupeKey },
    select: { id: true },
  });
  if (existing) {
    return { status: "skipped", reason: "already_sent" };
  }

  const origin = appOrigin();
  const url = `${origin}/schools/${opts.school.id}`;
  const staleTokens: string[] = [];
  let delivered = 0;
  let lastError: string | undefined;

  for (const row of opts.tokens) {
    const result = await sendFcmMessage({
      token: row.token,
      title: content.title,
      body: content.body,
      data: {
        type: content.type,
        schoolId: opts.school.id,
        url,
        tag: dedupeKey,
      },
    });

    if (result.status === "sent") {
      delivered += 1;
    } else {
      lastError = result.error;
      if (result.staleToken) staleTokens.push(row.token);
    }
  }

  if (staleTokens.length > 0) {
    await pruneStalePushTokens(staleTokens);
  }

  if (delivered === 0) {
    return {
      status: "failed",
      error: lastError ?? "push_delivery_failed",
    };
  }

  try {
    await prisma.notificationLog.create({
      data: {
        userId: opts.userId,
        type: content.type,
        dedupeKey,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("Unique constraint")) {
      return { status: "skipped", reason: "already_sent" };
    }
    log.warn("push.log_insert_failed", {
      userId: opts.userId,
      dedupeKey,
      error: message,
    });
  }

  return { status: "sent" };
}
