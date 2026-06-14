import { prisma } from "@/lib/prisma";
import { log } from "@/lib/logger";
import { sendSchoolScheduledPush } from "@/lib/push/send-school-scheduled";

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
  pushSent: number;
  pushSkipped: number;
  pushFailed: number;
};

const USERS_PER_CRON_RUN = 100;
const MAX_SCHOOLS_PER_USER = 50;

export async function runScheduledSchoolNotifications(
  now = new Date(),
): Promise<ScheduledNotificationsSummary> {
  const summary: ScheduledNotificationsSummary = {
    usersScanned: 0,
    schoolsChecked: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
    pushSent: 0,
    pushSkipped: 0,
    pushFailed: 0,
  };

  const users = await prisma.user.findMany({
    where: {
      schools: {
        some: {
          OR: [{ deadline: { not: null } }, { reminderAt: { not: null } }],
        },
      },
      OR: [
        { email: { not: null } },
        {
          AND: [
            { profile: { is: { deadlinePushEnabled: true } } },
            { pushTokens: { some: {} } },
          ],
        },
      ],
    },
    select: {
      id: true,
      email: true,
      name: true,
      profile: { select: { timezone: true, deadlinePushEnabled: true } },
      pushTokens: { select: { id: true, token: true } },
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
        take: MAX_SCHOOLS_PER_USER,
        orderBy: { deadline: "asc" },
      },
    },
    take: USERS_PER_CRON_RUN,
    orderBy: { id: "asc" },
  });

  for (const user of users) {
    const hasEmail = Boolean(user.email?.trim());
    const hasPush =
      Boolean(user.profile?.deadlinePushEnabled) && user.pushTokens.length > 0;
    if ((!hasEmail && !hasPush) || user.schools.length === 0) continue;

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
        summary.pushSkipped += 1;
        continue;
      }

      if (hasEmail) {
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
      } else {
        summary.skipped += 1;
      }

      if (hasPush) {
        const pushResult = await sendSchoolScheduledPush({
          userId: user.id,
          pushEnabled: Boolean(user.profile?.deadlinePushEnabled),
          tokens: user.pushTokens,
          school,
          timezone,
          sendDeadline30d: flags.sendDeadline30d,
          sendReminderToday: flags.sendReminderToday,
          localToday,
        });

        if (pushResult.status === "sent") summary.pushSent += 1;
        else if (pushResult.status === "failed") summary.pushFailed += 1;
        else summary.pushSkipped += 1;
      } else {
        summary.pushSkipped += 1;
      }
    }
  }

  if (users.length >= USERS_PER_CRON_RUN) {
    log.warn("notifications.cron.user_cap_reached", {
      cap: USERS_PER_CRON_RUN,
    });
  }

  log.info("notifications.scheduled_complete", summary);
  return summary;
}
