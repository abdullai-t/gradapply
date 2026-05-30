import { prisma } from "@/lib/prisma";
import { log } from "@/lib/logger";

import {
  localTodayYmd,
  resolveUserTimezone,
  schoolNotifyFlags,
} from "./deadline-schedule";
import { sendSchoolScheduledEmail } from "./send";

export type ScheduledNotificationsSummary = {
  usersScanned: number;
  schoolsChecked: number;
  sent: number;
  skipped: number;
  failed: number;
};

export async function runScheduledSchoolNotifications(
  now = new Date(),
): Promise<ScheduledNotificationsSummary> {
  const summary: ScheduledNotificationsSummary = {
    usersScanned: 0,
    schoolsChecked: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
  };

  const users = await prisma.user.findMany({
    where: {
      email: { not: null },
    },
    select: {
      id: true,
      email: true,
      name: true,
      profile: { select: { timezone: true } },
      schools: {
        where: {
          OR: [{ deadline: { not: null } }, { reminderAt: { not: null } }],
        },
        select: {
          id: true,
          name: true,
          program: true,
          deadline: true,
          reminderAt: true,
          reminderNote: true,
          status: true,
        },
      },
    },
  });

  for (const user of users) {
    if (!user.email?.trim() || user.schools.length === 0) continue;
    summary.usersScanned += 1;

    const timezone = resolveUserTimezone(user.profile?.timezone);
    const localToday = localTodayYmd(now, timezone);

    for (const school of user.schools) {
      summary.schoolsChecked += 1;
      const flags = schoolNotifyFlags({
        deadline: school.deadline,
        reminderAt: school.reminderAt,
        status: school.status,
        now,
        timezone,
      });

      if (!flags.sendDeadline30d && !flags.sendReminderToday) {
        summary.skipped += 1;
        continue;
      }

      const result = await sendSchoolScheduledEmail({
        user: { id: user.id, email: user.email, name: user.name },
        school,
        timezone,
        sendDeadline30d: flags.sendDeadline30d,
        sendReminderToday: flags.sendReminderToday,
        localToday,
      });

      if (result.status === "sent") summary.sent += 1;
      else if (result.status === "failed") summary.failed += 1;
      else summary.skipped += 1;
    }
  }

  log.info("notifications.scheduled_complete", summary);
  return summary;
}
