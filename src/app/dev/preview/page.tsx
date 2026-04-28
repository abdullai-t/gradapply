/**
 * Dev-only preview route — renders the new tactile Dashboard with seeded
 * mock data so we can do visual QA without authenticating. Returns a 404 in
 * production. Mounted at `/dev/preview`.
 */
import { format } from "date-fns";
import { notFound } from "next/navigation";

import { StatTile } from "@/components/stat-tile";
import { ReadinessGauge } from "@/features/dashboard/readiness-gauge";
import { StreakCard } from "@/features/dashboard/streak-card";
import { DailyMission } from "@/features/dashboard/daily-mission";
import { DocStatusGrid } from "@/features/dashboard/doc-status-grid";
import { RecSchoolGrid } from "@/features/dashboard/rec-school-grid";
import { Sidebar } from "@/features/shell/sidebar";
import { TopBar } from "@/features/shell/topbar";
import { FAB } from "@/features/shell/fab";
import { MobileNav } from "@/features/shell/mobile-nav";

export default function PreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const today = new Date();
  const nextDeadline = new Date(today);
  nextDeadline.setDate(today.getDate() + 12);

  return (
    <div className="relative min-h-screen md:flex bg-[var(--background)] text-[var(--on-background)]">
      <Sidebar />
      <div className="flex min-h-screen flex-1 flex-col">
        <TopBar />
        <main
          className="flex-1 px-4 py-6 md:px-8 md:py-8 pb-24 md:pb-12"
          style={{ maxWidth: "1320px", margin: "0 auto", width: "100%" }}
        >
          <div className="slide-in">
            <header
              className="rise-in mb-10"
              style={{ animationDelay: "0.05s" }}
            >
              <h1 className="t-display-lg m-0 text-[var(--on-background)]">
                Welcome back, Alex.
              </h1>
              <p className="t-body-lg m-0 mt-2 text-[var(--on-surface-variant)]">
                You&apos;re making great progress. Your next deadline is in{" "}
                <span className="font-bold text-[var(--primary)]">12 days</span>.
              </p>
            </header>

            <div
              className="rise-in mb-6"
              style={{ animationDelay: "0.15s" }}
            >
              <StreakCard
                streakDays={12}
                weekActivity={[true, true, true, true, false, false, false]}
                todayIndex={4}
              />
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div
                className="rise-in lg:col-span-2"
                style={{ animationDelay: "0.25s" }}
              >
                <div className="tactile-card flex flex-col gap-8 rounded-3xl border-2 border-[var(--outline-variant)] p-8 md:flex-row md:items-center">
                  <ReadinessGauge pct={82} />
                  <div className="grid flex-1 grid-cols-2 gap-3">
                    <StatTile
                      icon="school"
                      tone="primary"
                      value={12}
                      label="Schools saved"
                      delay={0.4}
                    />
                    <StatTile
                      icon="pending_actions"
                      tone="tertiary"
                      value={3}
                      label="LORs pending"
                      delay={0.5}
                    />
                    <StatTile
                      icon="event"
                      tone="destructive"
                      value={format(nextDeadline, "MMM d")}
                      label="Next deadline"
                      delay={0.6}
                    />
                    <StatTile
                      icon="history_edu"
                      tone="primary"
                      value="2/4"
                      label="Essays drafted"
                      delay={0.7}
                    />
                  </div>
                </div>
              </div>
              <div className="rise-in" style={{ animationDelay: "0.35s" }}>
                <DailyMission
                  title="Refine SOP abstract"
                  body="Make your opening paragraph unforgettable for Stanford's admissions committee."
                  href="/emails"
                  cta="Start mission"
                />
              </div>
            </div>

            <div className="mt-10">
              <DocStatusGrid
                items={[
                  {
                    icon: "article",
                    tone: "primary",
                    status: "In progress",
                    title: "Statement of purpose",
                    body: "Second draft completion. Goal: 1000 words.",
                    cta: "Continue editing",
                    ctaIcon: "arrow_forward",
                    href: "/documents",
                  },
                  {
                    icon: "task",
                    tone: "destructive",
                    status: "Action needed",
                    title: "Transcripts",
                    body: "Official PDF for Michigan is missing.",
                    cta: "Upload document",
                    ctaIcon: "upload",
                    href: "/documents",
                    showBlinkDot: true,
                  },
                  {
                    icon: "group",
                    tone: "tertiary",
                    status: "Pending",
                    title: "Letters of rec",
                    body: "Dr. Aris requested a follow-up reminder.",
                    cta: "View status",
                    ctaIcon: "visibility",
                    href: "/documents",
                  },
                ]}
              />
            </div>

            <RecSchoolGrid
              items={[
                {
                  id: "mit",
                  name: "MIT",
                  program: "Ph.D. in Computer Science",
                  score: 98,
                  tone: "tertiary",
                  tag: "High match",
                  deadline: "Dec 15",
                },
                {
                  id: "stanford",
                  name: "Stanford",
                  program: "MS in AI",
                  score: 94,
                  tone: "primary",
                  tag: "Dream match",
                  deadline: "Jan 5",
                },
                {
                  id: "eth",
                  name: "ETH Zurich",
                  program: "MSc in Robotics",
                  score: 91,
                  tone: "secondary",
                  tag: "Solid match",
                  deadline: "Dec 1",
                },
              ]}
            />

            <div className="mt-12 rounded-3xl border-2 border-dashed border-[var(--outline-variant)] p-6 text-center">
              <p className="t-label-lg">Preview mode · seeded data · /dev/preview</p>
              <p className="mt-1 text-sm text-[var(--on-surface-variant)]">
                Toggle theme via the avatar dropdown in the sidebar footer.
              </p>
            </div>
          </div>
        </main>
      </div>
      <MobileNav />
      <FAB />
    </div>
  );
}
