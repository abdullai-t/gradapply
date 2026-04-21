import Link from "next/link";
import { format } from "date-fns";
import {
  ArrowRight,
  Bell,
  CalendarClock,
  Crown,
  FileStack,
  GraduationCap,
  Landmark,
  Mail,
  Sparkles,
} from "lucide-react";
import { auth } from "@/auth";
import { admissionTermLabel } from "@/lib/admission-term";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { SchoolStatus } from "@prisma/client";
import { deadlineUrgency } from "@/lib/deadline-urgency";

const DOC_TYPE_LABEL: Record<string, string> = {
  cv: "CV",
  sop_draft: "Statement of purpose",
  transcript: "Transcript",
  gre: "GRE",
  other: "Other",
};

function dossierCompleteness(args: {
  profile: {
    targetDegree: string | null;
    focusArea: string | null;
    researchInterests: string | null;
    bio: string | null;
  } | null;
  schoolCount: number;
  documentCount: number;
}): number {
  let points = 0;
  const total = 6;
  const p = args.profile;
  if (p?.targetDegree?.trim()) points++;
  if (p?.focusArea?.trim() || p?.researchInterests?.trim()) points++;
  if (p?.bio?.trim()) points++;
  if (args.schoolCount > 0) points++;
  if (args.documentCount > 0) points++;
  if (args.schoolCount >= 3) points++;
  return Math.min(100, Math.round((points / total) * 100));
}

function firstName(name: string | null | undefined): string {
  if (!name?.trim()) return "there";
  return name.trim().split(/\s+/)[0] ?? "there";
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const settingsEnabled = await isFeatureEnabled("user_settings_page", false);

  const [
    schools,
    emailThreadCount,
    documents,
    profile,
    upcomingSchools,
    reminderSchools,
    currentUser,
  ] = await Promise.all([
    prisma.school.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.profEmail.count({
      where: { userId: session.user.id },
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
    prisma.school.findMany({
      where: { userId: session.user.id, reminderAt: { not: null } },
      orderBy: [{ reminderAt: "asc" }, { name: "asc" }],
      take: 8,
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

  const spotlight = upcomingSchools[0];
  const accepted = byStatus.ACCEPTED ?? 0;
  const isFreePlan = currentUser?.planTier === "FREE";
  const showUpgradePrompts = isFreePlan && settingsEnabled;

  const insight =
    profile?.researchInterests?.trim().slice(0, 220) ||
    "Add research interests on your Profile so your assistant can align outreach and essays with the programs you care about.";

  return (
    <div className="mx-auto max-w-7xl space-y-8 pb-8">
      {/* Hero */}
      <section className="glass-panel relative overflow-hidden rounded-2xl border border-white/10 p-6 md:p-8">
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-primary/15 blur-3xl"
          aria-hidden
        />
        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/90">
              The dossier
            </p>
            <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
              Welcome back, {greet}.
            </h1>
            <p className="max-w-xl text-sm leading-relaxed text-muted-foreground md:text-base">
              Your application dossier is{" "}
              <span className="font-medium text-foreground">{complete}%</span>{" "}
              complete. {accepted > 0 ? `${accepted} acceptance${accepted === 1 ? "" : "s"} on record. ` : ""}
              Keep deadlines and materials moving together.
            </p>
            <div className="max-w-md pt-1">
              <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                <span>Dossier readiness</span>
                <span>{complete}%</span>
              </div>
              <Progress value={complete} />
            </div>
          </div>

          <div className="w-full shrink-0 lg:max-w-xl xl:max-w-2xl">
            <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
              <div className="relative min-w-0 flex-1">
                <FileStack
                  className="pointer-events-none absolute left-3 top-1/2 z-[1] h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  readOnly
                  placeholder="Search archive…"
                  className="glass-input h-11 w-full cursor-not-allowed pl-10 pr-4 text-sm"
                  aria-label="Search archive (coming soon)"
                />
              </div>
              <div className="flex w-full shrink-0 gap-2 sm:w-auto sm:justify-end">
                <Button
                  variant={showUpgradePrompts ? "secondary" : "outline"}
                  className="h-11 flex-1 border-white/20 bg-secondary/30 px-4 text-sm font-medium backdrop-blur-sm hover:bg-secondary/50 sm:min-w-[7.25rem] sm:flex-initial"
                  disabled={isFreePlan && !showUpgradePrompts}
                  asChild={!isFreePlan || showUpgradePrompts}
                >
                  {isFreePlan ? (
                    showUpgradePrompts ? (
                      <Link href="/settings">Unlock library</Link>
                    ) : (
                      <span>Library (Plus)</span>
                    )
                  ) : (
                    <Link href="/documents">Library</Link>
                  )}
                </Button>
                {showUpgradePrompts ? (
                  <Button
                    asChild
                    className="h-11 flex-1 gap-2 px-4 text-sm font-medium shadow-md shadow-primary/30 sm:min-w-[8.75rem] sm:flex-initial"
                  >
                    <Link href="/settings">
                      <Crown className="h-4 w-4 shrink-0" aria-hidden />
                      Upgrade plan
                    </Link>
                  </Button>
                ) : (
                  <Button
                    asChild
                    className="h-11 flex-1 gap-2 px-4 text-sm font-medium shadow-md shadow-primary/20 sm:min-w-[8.75rem] sm:flex-initial"
                  >
                    <Link href="/schools">
                      New entry
                      <ArrowRight className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Metric strip */}
      <div className="grid gap-4 md:grid-cols-3">
        <MetricTile
          label="Planning"
          count={byStatus.PLANNING ?? 0}
          hint="Programs you're shaping"
          accent="border-l-4 border-l-amber-400/70"
        />
        <MetricTile
          label="Applied"
          count={byStatus.APPLIED ?? 0}
          hint="Applications submitted"
          accent="border-l-4 border-l-sky-400/70"
        />
        <MetricTile
          label="In review"
          count={byStatus.WAITING ?? 0}
          hint="Awaiting decisions"
          accent="border-l-4 border-l-violet-400/70"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-5 lg:gap-8">
        {/* Left column */}
        <div className="space-y-6 lg:col-span-3">
          <section className="glass-panel rounded-2xl border border-white/10">
            <div className="flex flex-col gap-2 border-b border-white/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-display text-lg font-semibold">Recent archive</h2>
                <p className="text-xs text-muted-foreground">
                  Latest uploads — link out to manage versions in the library.
                </p>
              </div>
              {isFreePlan ? (
                showUpgradePrompts ? (
                  <Button variant="ghost" size="sm" className="text-primary" asChild>
                    <Link href="/settings">Upgrade to access documents</Link>
                  </Button>
                ) : (
                  <span className="text-xs text-amber-300">Documents available on paid plans</span>
                )
              ) : (
                <Button variant="ghost" size="sm" className="text-primary" asChild>
                  <Link href="/documents">Open library</Link>
                </Button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-5 py-3 font-medium">Document</th>
                    <th className="px-5 py-3 font-medium">Type</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="hidden px-5 py-3 font-medium sm:table-cell">
                      Updated
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {documents.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-5 py-10 text-center text-muted-foreground"
                      >
                        No documents yet.{" "}
                        {isFreePlan ? (
                          showUpgradePrompts ? (
                            <Link href="/settings" className="text-primary underline-offset-4 hover:underline">
                              Upgrade to unlock document uploads
                            </Link>
                          ) : (
                            <span>Document uploads are on paid plans.</span>
                          )
                        ) : (
                          <Link href="/documents" className="text-primary underline-offset-4 hover:underline">
                            Upload to your library
                          </Link>
                        )}
                        {!isFreePlan ? "." : null}
                      </td>
                    </tr>
                  ) : (
                    documents.map((doc) => (
                      <tr
                        key={doc.id}
                        className="border-b border-white/[0.06] last:border-0 hover:bg-white/[0.03]"
                      >
                        <td className="max-w-[200px] truncate px-5 py-3.5 font-medium">
                          {doc.name}
                        </td>
                        <td className="px-5 py-3.5 text-muted-foreground">
                          {DOC_TYPE_LABEL[doc.type] ?? doc.type}
                        </td>
                        <td className="px-5 py-3.5">
                          <Badge
                            variant="outline"
                            className="border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                          >
                            Archived
                          </Badge>
                        </td>
                        <td className="hidden whitespace-nowrap px-5 py-3.5 text-muted-foreground sm:table-cell">
                          {format(doc.createdAt, "MMM d, yyyy")}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="glass-panel rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.07] to-transparent p-5 md:p-6">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <Sparkles className="h-5 w-5" aria-hidden />
              </div>
              <div className="min-w-0 space-y-2">
                <h2 className="font-display text-lg font-semibold">
                  Curator insight
                </h2>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {insight}
                  {profile?.researchInterests && profile.researchInterests.length > 220 ? "…" : ""}
                </p>
                {isFreePlan ? (
                  <div className="space-y-2">
                    <p className="text-xs text-amber-300">
                      AI assistant is available on PLUS and PRO plans.
                    </p>
                    {showUpgradePrompts ? (
                      <Button size="sm" className="gap-2" asChild>
                        <Link href="/settings">
                          <Crown className="h-4 w-4" aria-hidden />
                          Upgrade to use assistant
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                ) : (
                  <Button variant="link" className="h-auto p-0 text-primary" asChild>
                    <Link href="/assistant">Open AI assistant</Link>
                  </Button>
                )}
              </div>
            </div>
          </section>
        </div>

        {/* Right column */}
        <div className="space-y-6 lg:col-span-2">
          <section className="glass-panel rounded-2xl border border-white/10">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-primary" aria-hidden />
                <h2 className="font-display text-lg font-semibold">
                  Critical deadlines
                </h2>
              </div>
              <Badge variant="outline" className="font-normal">
                {upcomingSchools.length} upcoming
              </Badge>
            </div>
            <ul className="divide-y divide-white/[0.06] px-2 py-2">
              {upcomingSchools.length === 0 ? (
                <li className="px-3 py-8 text-center text-sm text-muted-foreground">
                  No upcoming deadlines.{" "}
                  <Link href="/schools" className="text-primary underline-offset-4 hover:underline">
                    Add schools with dates
                  </Link>
                  .
                </li>
              ) : (
                upcomingSchools.map((school) => {
                  const d = school.deadline!;
                  const u = deadlineUrgency(d);
                  return (
                    <li key={school.id} className="flex gap-3 px-3 py-3.5">
                      <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-center">
                        <span className="text-[10px] font-medium uppercase text-muted-foreground">
                          {format(d, "MMM")}
                        </span>
                        <span className="text-lg font-semibold leading-none">
                          {format(d, "d")}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{school.name}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {school.program}
                          {school.term
                            ? ` · ${admissionTermLabel(school.term)}`
                            : ""}
                        </div>
                        <div
                          className={
                            u.tone === "destructive"
                              ? "mt-1 text-xs font-medium text-red-400"
                              : u.tone === "amber"
                                ? "mt-1 text-xs font-medium text-amber-300"
                                : "mt-1 text-xs text-muted-foreground"
                          }
                        >
                          {u.label}
                        </div>
                      </div>
                    </li>
                  );
                })
              )}
            </ul>
            <div className="border-t border-dashed border-white/15 px-5 py-4">
              <Button variant="outline" size="sm" className="w-full border-dashed" asChild>
                <Link href="/timeline">Full timeline & reminders</Link>
              </Button>
            </div>
          </section>

          <section className="glass-panel rounded-2xl border border-white/10">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-primary" aria-hidden />
                <h2 className="font-display text-lg font-semibold">
                  Reminder pings
                </h2>
              </div>
              <Button variant="ghost" size="sm" className="text-primary" asChild>
                <Link href="/timeline">Manage</Link>
              </Button>
            </div>
            <ul className="divide-y divide-white/[0.06] px-2 py-2">
              {reminderSchools.length === 0 ? (
                <li className="px-3 py-8 text-center text-sm text-muted-foreground">
                  No reminders yet.{" "}
                  <Link href="/timeline" className="text-primary underline-offset-4 hover:underline">
                    Schedule on the timeline
                  </Link>
                  .
                </li>
              ) : (
                reminderSchools.map((school) => {
                  const r = school.reminderAt!;
                  const miss = r.getTime() < Date.now();
                  return (
                    <li key={school.id} className="flex gap-3 px-3 py-3.5">
                      <div
                        className={`flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg border text-center ${
                          miss
                            ? "border-amber-500/35 bg-amber-500/10"
                            : "border-white/10 bg-white/[0.04]"
                        }`}
                      >
                        <span className="text-[10px] font-medium uppercase text-muted-foreground">
                          {format(r, "MMM")}
                        </span>
                        <span className="text-lg font-semibold leading-none">
                          {format(r, "d")}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{school.name}</div>
                        {school.reminderNote?.trim() ? (
                          <div className="line-clamp-2 text-xs text-muted-foreground">
                            {school.reminderNote.trim()}
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground">
                            Ping scheduled
                          </div>
                        )}
                        {miss ? (
                          <div className="mt-1 text-xs font-medium text-amber-300">
                            Check in
                          </div>
                        ) : (
                          <div className="mt-1 text-xs text-muted-foreground">
                            {format(r, "MMM d, yyyy")}
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })
              )}
            </ul>
          </section>

          <section className="glass-panel overflow-hidden rounded-2xl border border-white/10">
            <div className="relative aspect-[16/10] bg-gradient-to-br from-[#001f3f] via-[hsl(232_32%_14%)] to-[hsl(230_35%_8%)]">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(251,191,36,0.12),_transparent_55%)]" />
              <Landmark className="absolute bottom-4 right-4 h-24 w-24 text-white/10" aria-hidden />
              <div className="relative flex h-full flex-col justify-end p-5 md:p-6">
                <Badge className="mb-2 w-fit border-amber-400/30 bg-amber-500/15 text-amber-100">
                  Campus spotlight
                </Badge>
                {spotlight ? (
                  <>
                    <h3 className="font-display text-xl font-semibold text-white md:text-2xl">
                      {spotlight.name}
                    </h3>
                    <p className="mt-1 text-sm text-white/75">
                      {spotlight.country ?? "Location TBD"}
                      {spotlight.term ? ` · ${admissionTermLabel(spotlight.term)}` : ""}{" "}
                      · Next deadline{" "}
                      {spotlight.deadline
                        ? format(spotlight.deadline, "MMM d, yyyy")
                        : "—"}
                    </p>
                  </>
                ) : (
                  <>
                    <h3 className="font-display text-xl font-semibold text-white md:text-2xl">
                      Build your shortlist
                    </h3>
                    <p className="mt-1 max-w-sm text-sm text-white/75">
                      Add schools with deadlines to surface your next milestone here.
                    </p>
                  </>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-4 w-fit gap-2 bg-white/15 text-white backdrop-blur-sm hover:bg-white/25"
                  asChild
                >
                  <Link href="/schools">
                    <GraduationCap className="h-4 w-4" aria-hidden />
                    School tracker
                  </Link>
                </Button>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/emails"
              className="glass-panel flex items-center gap-3 rounded-xl border border-white/10 p-4 transition-colors hover:border-primary/30"
            >
              <Mail className="h-5 w-5 shrink-0 text-primary" aria-hidden />
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">Outreach</div>
                <div className="truncate font-medium">
                  {emailThreadCount} threads
                </div>
              </div>
            </Link>
            <Link
              href="/profile"
              className="glass-panel flex items-center gap-3 rounded-xl border border-white/10 p-4 transition-colors hover:border-primary/30"
            >
              <Bell className="h-5 w-5 shrink-0 text-primary" aria-hidden />
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">Profile</div>
                <div className="truncate font-medium">Credentials</div>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricTile({
  label,
  count,
  hint,
  accent,
}: {
  label: string;
  count: number;
  hint: string;
  accent: string;
}) {
  return (
    <div
      className={`glass-panel rounded-2xl border border-white/10 bg-white/[0.04] p-5 ${accent}`}
    >
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 font-display text-4xl font-semibold tabular-nums">
        {String(count).padStart(2, "0")}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
