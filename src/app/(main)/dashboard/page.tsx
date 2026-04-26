import Link from "next/link";
import { format } from "date-fns";

import { auth } from "@/auth";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { prisma } from "@/lib/prisma";
import { SchoolStatus } from "@prisma/client";

import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/stat-tile";
import { ReadinessGauge } from "@/features/dashboard/readiness-gauge";
import { StreakCard } from "@/features/dashboard/streak-card";
import { DailyMission } from "@/features/dashboard/daily-mission";
import { DocStatusGrid } from "@/features/dashboard/doc-status-grid";
import { RecSchoolGrid } from "@/features/dashboard/rec-school-grid";
import {
  buildDocStatusItems,
  buildRecSchools,
  computeDerivedStreak,
  dossierCompleteness,
  firstName,
  pickDailyMission,
} from "@/features/dashboard/compute";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const settingsEnabled = await isFeatureEnabled("user_settings_page", false);

  const [
    schools,
    documents,
    profile,
    upcomingSchools,
    currentUser,
  ] = await Promise.all([
    prisma.school.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.document.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.profile.findUnique({ where: { userId: session.user.id } }),
    prisma.school.findMany({
      where: {
        userId: session.user.id,
        deadline: { not: null },
        status: {
          in: [
            SchoolStatus.PLANNING,
            SchoolStatus.APPLIED,
            SchoolStatus.WAITING,
          ],
        },
      },
      orderBy: { deadline: "asc" },
      take: 6,
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { planTier: true },
    }),
  ]);

  const byStatus = schools.reduce(
    (acc, s) => {
      acc[s.status] = (acc[s.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<SchoolStatus, number>,
  );

  const greet = firstName(session.user.name);
  const complete = dossierCompleteness({
    profile,
    schoolCount: schools.length,
    documentCount: documents.length,
  });

  const inProgress =
    (byStatus.PLANNING ?? 0) +
    (byStatus.APPLIED ?? 0) +
    (byStatus.WAITING ?? 0);
  const submitted = (byStatus.APPLIED ?? 0) + (byStatus.ACCEPTED ?? 0);
  const accepted = byStatus.ACCEPTED ?? 0;
  const isFreePlan = currentUser?.planTier === "FREE";
  const showUpgradePrompts = isFreePlan && settingsEnabled;

  const nextDeadline = upcomingSchools.find((s) => s.deadline);
  const daysUntilNext = nextDeadline?.deadline
    ? Math.max(
        0,
        Math.ceil(
          (nextDeadline.deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
        ),
      )
    : null;

  const mission = pickDailyMission({
    upcoming: upcomingSchools.map((s) => ({
      id: s.id,
      name: s.name,
      deadline: s.deadline,
    })),
    profile: profile
      ? {
          researchInterests: profile.researchInterests,
          bio: profile.bio,
        }
      : null,
    schoolCount: schools.length,
    documentCount: documents.length,
  });

  const docItems = buildDocStatusItems({
    documents: documents.map((d) => ({
      type: d.type,
      name: d.name,
      createdAt: d.createdAt,
    })),
    upcoming: upcomingSchools.map((s) => ({
      id: s.id,
      name: s.name,
      deadline: s.deadline,
    })),
  });

  const recSchools = buildRecSchools(
    schools.slice(0, 3).map((s) => ({
      id: s.id,
      name: s.name,
      program: s.program,
      deadline: s.deadline,
      status: s.status,
    })),
  );

  // Derive streak from school activity timestamps until UserActivityDay ships.
  const recentActivityDates = schools.flatMap((s) =>
    [s.updatedAt, s.reminderAt].filter((d): d is Date => d != null),
  );
  const streak = computeDerivedStreak({ recentActivityDates });

  return (
    <div className="slide-in">
      {/* Welcome header */}
      <header
        className="rise-in mb-10"
        style={{ animationDelay: "0.05s" }}
      >
        <h1 className="t-display-lg m-0 text-[var(--on-background)]">
          Welcome back, {greet}.
        </h1>
        <p className="t-body-lg m-0 mt-2 text-[var(--on-surface-variant)]">
          {daysUntilNext != null && nextDeadline ? (
            <>
              You&apos;re making great progress. Your next deadline is in{" "}
              <span className="font-bold text-[var(--primary)]">
                {daysUntilNext} {daysUntilNext === 1 ? "day" : "days"}
              </span>
              .
            </>
          ) : (
            <>
              Your dossier is{" "}
              <span className="font-bold text-[var(--primary)]">
                {complete}%
              </span>{" "}
              complete. Keep deadlines and materials moving together.
            </>
          )}
        </p>
      </header>

      {/* Streak */}
      <div className="rise-in mb-6" style={{ animationDelay: "0.15s" }}>
        <StreakCard
          streakDays={streak.streakDays}
          weekActivity={streak.weekActivity}
          todayIndex={streak.todayIndex}
        />
      </div>

      {/* Gauge + Mission */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div
          className="rise-in lg:col-span-2"
          style={{ animationDelay: "0.25s" }}
        >
          <div className="tactile-card flex flex-col gap-8 rounded-3xl border-2 border-[var(--outline-variant)] p-8 md:flex-row md:items-center">
            <ReadinessGauge pct={complete} />
            <div className="grid flex-1 grid-cols-2 gap-3">
              <StatTile
                icon="school"
                tone="primary"
                value={schools.length}
                label="Schools saved"
                delay={0.4}
              />
              <StatTile
                icon="pending_actions"
                tone="tertiary"
                value={inProgress}
                label="In progress"
                delay={0.5}
              />
              <StatTile
                icon="event"
                tone="destructive"
                value={
                  nextDeadline?.deadline
                    ? format(nextDeadline.deadline, "MMM d")
                    : "—"
                }
                label="Next deadline"
                delay={0.6}
              />
              <StatTile
                icon="history_edu"
                tone="primary"
                value={`${accepted}/${schools.length || "—"}`}
                label="Acceptances"
                delay={0.7}
              />
            </div>
          </div>
        </div>
        <div className="rise-in" style={{ animationDelay: "0.35s" }}>
          <DailyMission
            title={mission.title}
            body={mission.body}
            href={mission.href}
            cta={mission.cta}
          />
        </div>
      </div>

      {/* Documents row */}
      <div className="mt-10">
        <DocStatusGrid items={docItems} />
      </div>

      {/* Recommended */}
      <RecSchoolGrid items={recSchools} />

      {/* Upgrade prompt for FREE plan */}
      {showUpgradePrompts ? (
        <section
          className="mt-12 rounded-3xl border-2 border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-8 text-center"
          aria-label="Upgrade prompt"
        >
          <Icon
            name="auto_awesome"
            fill
            size={28}
            className="text-[var(--primary)]"
          />
          <h3 className="t-headline-md mt-3">Unlock the full assistant</h3>
          <p className="mx-auto mt-2 max-w-prose text-[var(--on-surface-variant)]">
            Plus and Pro tiers unlock the assistant, document library, and
            higher AI quotas. {submitted ? "" : "Upgrade as you start submitting."}
          </p>
          <Button asChild className="mt-5" iconRight="arrow_forward">
            <Link href="/settings">Upgrade plan</Link>
          </Button>
        </section>
      ) : null}
    </div>
  );
}
