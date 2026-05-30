import Link from "next/link";
import { SchoolStatus } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isRecentOnboarding } from "@/lib/onboarding";

import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { StreakCard } from "@/features/dashboard/streak-card";
import { DailyMission } from "@/features/dashboard/daily-mission";
import { DocStatusGrid } from "@/features/dashboard/doc-status-grid";
import { FocusSchoolGrid } from "@/features/dashboard/focus-school-grid";
import { UrgentStrip } from "@/features/dashboard/urgent-strip";
import { DashboardReadinessPanel } from "@/features/dashboard/dashboard-readiness-panel";
import { UpcomingDeadlinesList } from "@/features/dashboard/upcoming-deadlines-list";
import { AggregateTrackerProgress } from "@/features/dashboard/aggregate-tracker-progress";
import { DashboardEmptyHero } from "@/features/dashboard/dashboard-empty-hero";
import { QuickActionsRow } from "@/features/dashboard/quick-actions-row";
import { GettingStartedCard } from "@/features/dashboard/getting-started-card";
import {
  aggregateTrackerProgress,
  buildDocStatusItems,
  buildDossierGaps,
  buildFocusSchools,
  buildUpcomingDeadlineRows,
  computeDerivedStreak,
  dossierCompleteness,
  firstName,
  gettingStartedItems,
  pickDailyMission,
  pickDashboardUrgent,
  shouldShowUpgradeBanner,
} from "@/features/dashboard/compute";

const schoolListSelect = {
  id: true,
  name: true,
  program: true,
  degree: true,
  deadline: true,
  reminderAt: true,
  reminderNote: true,
  status: true,
  updatedAt: true,
  requiredMaterials: true,
  letterRecommenders: true,
} as const;

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const [
    schools,
    documents,
    profile,
    upcomingSchools,
    currentUser,
    sopVariant,
  ] = await Promise.all([
    prisma.school.findMany({
      where: { userId: session.user.id },
      select: schoolListSelect,
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
    prisma.sopVariant.findFirst({
      where: { userId: session.user.id },
      select: { id: true, schoolId: true },
      orderBy: { updatedAt: "desc" },
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
  const dossierGaps = buildDossierGaps({
    profile,
    schoolCount: schools.length,
    documentCount: documents.length,
  });

  const inProgress =
    (byStatus.PLANNING ?? 0) +
    (byStatus.APPLIED ?? 0) +
    (byStatus.WAITING ?? 0);
  const accepted = byStatus.ACCEPTED ?? 0;
  const isFreePlan = currentUser?.planTier === "FREE";

  const nextDeadline = upcomingSchools.find((s) => s.deadline);
  const daysUntilNext = nextDeadline?.deadline
    ? Math.max(
        0,
        Math.ceil(
          (nextDeadline.deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
        ),
      )
    : null;

  const hasCv = documents.some((d) => d.type === "cv");
  const newUserWelcome = isRecentOnboarding(profile?.onboardingCompletedAt);
  const schoolCount = schools.length;
  const hasAnyDeadline = schools.some((s) => s.deadline != null);

  const mission = pickDailyMission({
    upcoming: upcomingSchools.map((s) => ({
      id: s.id,
      name: s.name,
      deadline: s.deadline,
    })),
    schools: schools.map((s) => ({
      id: s.id,
      name: s.name,
      deadline: s.deadline,
      requiredMaterials: s.requiredMaterials,
    })),
    profile: profile
      ? {
          researchInterests: profile.researchInterests,
          bio: profile.bio,
        }
      : null,
    schoolCount,
    documentCount: documents.length,
    sopSchoolId: sopVariant?.schoolId ?? schools[0]?.id ?? null,
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

  const focusSchools = buildFocusSchools(
    schools.map((s) => ({
      id: s.id,
      name: s.name,
      program: s.program,
      deadline: s.deadline,
      status: s.status,
      requiredMaterials: s.requiredMaterials,
    })),
  );

  const deadlineRows = buildUpcomingDeadlineRows(
    schools.map((s) => ({
      id: s.id,
      name: s.name,
      program: s.program,
      deadline: s.deadline,
      status: s.status,
    })),
  );

  const urgent = pickDashboardUrgent(
    schools.map((s) => ({
      id: s.id,
      name: s.name,
      status: s.status,
      deadline: s.deadline,
      reminderAt: s.reminderAt,
      reminderNote: s.reminderNote,
    })),
  );

  const trackerAgg = aggregateTrackerProgress(schools);

  const recentActivityDates = schools.flatMap((s) =>
    [s.updatedAt, s.reminderAt].filter((d): d is Date => d != null),
  );
  const streak = computeDerivedStreak({ recentActivityDates });

  const gettingStarted = gettingStartedItems({
    hasCv,
    schoolCount,
    hasOpenedSop: Boolean(sopVariant),
  });

  const showUpgrade = shouldShowUpgradeBanner({
    isFreePlan,
    schoolCount,
    documentCount: documents.length,
    dossierPct: complete,
  });

  const showTrackerCard =
    trackerAgg.activeCount > 0 &&
    (trackerAgg.materialsTotal > 0 || trackerAgg.lettersTotal > 0);
  const showProgressRow = deadlineRows.length > 0 || showTrackerCard;

  return (
    <div className="slide-in flex flex-col gap-10 pb-4">
      <header className="rise-in space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <h1 className="t-display-lg m-0 text-[var(--on-background)]">
              {newUserWelcome ? `Welcome, ${greet}.` : `Welcome back, ${greet}.`}
            </h1>
            <p className="t-body-lg m-0 mt-2 max-w-2xl text-[var(--on-surface-variant)]">
              {schoolCount === 0 ? (
                <>Add schools to unlock deadlines, materials tracking, and missions.</>
              ) : deadlineRows.length > 0 ? (
                <>
                  {deadlineRows.length} upcoming deadline
                  {deadlineRows.length === 1 ? "" : "s"} on your list.
                </>
              ) : daysUntilNext != null && nextDeadline ? (
                <>
                  Your next deadline is in{" "}
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
                  complete. Add deadlines to prioritize your week.
                </>
              )}
            </p>
          </div>
          {schoolCount > 0 ? <QuickActionsRow className="shrink-0" /> : null}
        </div>
      </header>

      {newUserWelcome ? (
        <GettingStartedCard items={gettingStarted} />
      ) : null}

      {schoolCount === 0 ? (
        <DashboardEmptyHero variant="no_schools" />
      ) : (
        <>
          <section aria-label="Today" className="flex flex-col gap-4">
            {urgent ? <UrgentStrip urgent={urgent} /> : null}
            {!hasAnyDeadline ? (
              <DashboardEmptyHero
                variant="no_deadlines"
                firstSchoolId={schools[0]?.id ?? null}
              />
            ) : null}

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-stretch">
              <div className="order-2 lg:order-1 lg:col-span-2">
                <DashboardReadinessPanel
                  complete={complete}
                  gaps={dossierGaps}
                  schoolCount={schoolCount}
                  inProgress={inProgress}
                  accepted={accepted}
                  nextDeadline={nextDeadline?.deadline}
                />
              </div>
              <div className="order-1 flex min-h-[280px] lg:order-2 lg:col-span-1">
                <DailyMission
                  title={mission.title}
                  body={mission.body}
                  href={mission.href}
                  cta={mission.cta}
                />
              </div>
            </div>
          </section>

          {showProgressRow ? (
            <section
              aria-label="Plan"
              className={
                deadlineRows.length > 0 && showTrackerCard
                  ? "grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start"
                  : "grid grid-cols-1 gap-6"
              }
            >
              {deadlineRows.length > 0 ? (
                <UpcomingDeadlinesList rows={deadlineRows} />
              ) : null}
              {showTrackerCard ? (
                <AggregateTrackerProgress {...trackerAgg} />
              ) : null}
            </section>
          ) : null}

          <section aria-label="Documents" className="space-y-4">
            <DocStatusGrid items={docItems} />
          </section>

          <section aria-label="Your schools">
            <FocusSchoolGrid items={focusSchools} />
          </section>

          <StreakCard
            streakDays={streak.streakDays}
            weekActivity={streak.weekActivity}
            todayIndex={streak.todayIndex}
            compact
          />
        </>
      )}

      {showUpgrade ? (
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
            Plus and Pro tiers unlock higher AI quotas and the full document
            library. Upgrade when you&apos;re ready to submit.
          </p>
          <Button asChild className="mt-5" iconRight="arrow_forward">
            <Link href="/settings">Upgrade plan</Link>
          </Button>
        </section>
      ) : null}
    </div>
  );
}
