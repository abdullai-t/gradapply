import { describe, expect, it } from "vitest";

import {
  buildSchoolScheduledPushContent,
  schoolPushDedupeKey,
} from "@/lib/push/send-school-scheduled";

const school = {
  id: "sch-1",
  name: "Example University",
  program: "Computer Science PhD",
  deadline: new Date("2026-07-01T12:00:00.000Z"),
  reminderAt: new Date("2026-06-15T12:00:00.000Z"),
  reminderNote: "Submit SOP draft",
};

describe("buildSchoolScheduledPushContent", () => {
  it("builds 30-day deadline copy", () => {
    const content = buildSchoolScheduledPushContent({
      school,
      timezone: "UTC",
      sendDeadline30d: true,
      sendReminderToday: false,
    });
    expect(content?.type).toBe("DEADLINE_30D");
    expect(content?.title).toContain("30 days");
    expect(content?.body).toContain("Computer Science PhD");
  });

  it("builds reminder copy with note", () => {
    const content = buildSchoolScheduledPushContent({
      school,
      timezone: "UTC",
      sendDeadline30d: false,
      sendReminderToday: true,
    });
    expect(content?.type).toBe("REMINDER");
    expect(content?.body).toBe("Submit SOP draft");
  });

  it("builds combined copy when both fire", () => {
    const content = buildSchoolScheduledPushContent({
      school,
      timezone: "UTC",
      sendDeadline30d: true,
      sendReminderToday: true,
    });
    expect(content?.type).toBe("SCHOOL_COMBINED");
    expect(content?.title).toContain("deadline & reminder");
  });

  it("returns null when nothing to send", () => {
    expect(
      buildSchoolScheduledPushContent({
        school,
        timezone: "UTC",
        sendDeadline30d: false,
        sendReminderToday: false,
      }),
    ).toBeNull();
  });
});

describe("schoolPushDedupeKey", () => {
  it("suffixes push channel on the email dedupe key", () => {
    expect(schoolPushDedupeKey("sch-1", "2026-06-02")).toBe(
      "school_notify:sch-1:2026-06-02:push",
    );
  });
});
