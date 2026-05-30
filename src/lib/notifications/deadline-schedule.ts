import { addDays } from "date-fns";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";

import type { SchoolStatus } from "@prisma/client";

export const DEFAULT_NOTIFICATION_TIMEZONE = "UTC";

const TERMINAL_STATUSES: SchoolStatus[] = [
  "ACCEPTED",
  "REJECTED",
  "WITHDRAWN",
];

export function resolveUserTimezone(profileTimezone: string | null | undefined): string {
  const tz = profileTimezone?.trim();
  if (!tz) return DEFAULT_NOTIFICATION_TIMEZONE;
  try {
    formatInTimeZone(new Date(), tz, "yyyy-MM-dd");
    return tz;
  } catch {
    return DEFAULT_NOTIFICATION_TIMEZONE;
  }
}

/** Calendar date `yyyy-MM-dd` for an instant in the given IANA timezone. */
export function localYmd(date: Date, timezone: string): string {
  return formatInTimeZone(date, timezone, "yyyy-MM-dd");
}

export function localTodayYmd(now: Date, timezone: string): string {
  return localYmd(now, timezone);
}

export function isTerminalSchoolStatus(status: SchoolStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

export type SchoolNotifyFlags = {
  sendDeadline30d: boolean;
  sendReminderToday: boolean;
};

export function schoolNotifyFlags(opts: {
  deadline: Date | null;
  reminderAt: Date | null;
  status: SchoolStatus;
  now: Date;
  timezone: string;
}): SchoolNotifyFlags {
  if (isTerminalSchoolStatus(opts.status)) {
    return { sendDeadline30d: false, sendReminderToday: false };
  }

  const localToday = localTodayYmd(opts.now, opts.timezone);
  const zonedNow = toZonedTime(opts.now, opts.timezone);
  const deadlineTarget = formatInTimeZone(
    addDays(zonedNow, 30),
    opts.timezone,
    "yyyy-MM-dd",
  );

  let sendDeadline30d = false;
  if (opts.deadline) {
    sendDeadline30d = localYmd(opts.deadline, opts.timezone) === deadlineTarget;
  }

  let sendReminderToday = false;
  if (opts.reminderAt) {
    sendReminderToday = localYmd(opts.reminderAt, opts.timezone) === localToday;
  }

  return { sendDeadline30d, sendReminderToday };
}

export function formatDateForEmail(date: Date, timezone: string): string {
  return formatInTimeZone(date, timezone, "MMMM d, yyyy");
}
