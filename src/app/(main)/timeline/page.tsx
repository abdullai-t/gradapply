"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { format, startOfMonth } from "date-fns";
import {
  AlarmClock,
  BellOff,
  CalendarClock,
  ChevronRight,
  Plus,
} from "lucide-react";
import type { AdmissionTerm } from "@prisma/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { admissionTermLabel } from "@/lib/admission-term";
import { deadlineDueMeta, deadlineUrgency } from "@/lib/deadline-urgency";
import { cn } from "@/lib/utils";

type SchoolPayload = {
  id: string;
  name: string;
  program: string;
  degree: string;
  country: string | null;
  term: AdmissionTerm | null;
  deadline: string | null;
  reminderAt: string | null;
  reminderNote: string | null;
  portalUrl: string | null;
  updatedAt: string;
};

export default function TimelinePage() {
  const [schools, setSchools] = useState<SchoolPayload[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/schools?sort=timeline");
    if (res.ok) setSchools(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const reminders = useMemo(
    () =>
      schools.filter((s) => s.reminderAt != null).sort((a, b) => {
        const ta = new Date(a.reminderAt!).getTime();
        const tb = new Date(b.reminderAt!).getTime();
        return ta - tb;
      }),
    [schools],
  );

  const scheduled = useMemo(() => {
    const withDl = schools.filter((s) => s.deadline != null);
    const noDl = schools.filter((s) => s.deadline == null);
    const byMonth = new Map<string, SchoolPayload[]>();
    for (const s of withDl) {
      const d = new Date(s.deadline!);
      const key = format(startOfMonth(d), "yyyy-MM");
      const arr = byMonth.get(key) ?? [];
      arr.push(s);
      byMonth.set(key, arr);
    }
    for (const arr of Array.from(byMonth.values())) {
      arr.sort(
        (a: SchoolPayload, b: SchoolPayload) =>
          new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime(),
      );
    }
    const monthKeys = Array.from(byMonth.keys()).sort();
    return { monthKeys, byMonth, noDl };
  }, [schools]);

  const clearReminder = async (id: string) => {
    const res = await fetch(`/api/schools/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reminderAt: null, reminderNote: null }),
    });
    if (res.ok) await load();
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-24">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Timeline</h1>
          <p className="text-muted-foreground">
            Deadlines grouped by month, optional reminders per school, and overdue highlights.
          </p>
        </div>
        <Button asChild className="shrink-0 gap-2 shadow-md shadow-primary/20">
          <Link href="/schools">
            <Plus className="h-4 w-4" aria-hidden />
            Schools & reminders
          </Link>
        </Button>
      </div>

      <Card className="glass-panel border-white/10">
        <CardHeader className="flex flex-row items-start gap-3 space-y-0 pb-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <AlarmClock className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <CardTitle className="font-display text-lg">Active reminders</CardTitle>
            <CardDescription>
              Nudges you set alongside a school. Clearing removes the ping but keeps your deadline.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 pt-0">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : reminders.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No reminders yet — open a school card on{" "}
              <Link href="/schools" className="text-primary underline-offset-4 hover:underline">
                Schools
              </Link>{" "}
              and pick a reminder date (and optional note).
            </p>
          ) : (
            <ul className="divide-y divide-white/[0.06] rounded-xl border border-white/10 bg-muted/20">
              {reminders.map((school) => {
                const r = new Date(school.reminderAt!);
                const past = r.getTime() < Date.now();
                return (
                  <li
                    key={school.id}
                    className={cn(
                      "flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
                      past && "bg-amber-500/[0.06]",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{school.name}</span>
                        <Badge variant="outline" className="font-normal">
                          {past ? "Due ping" : format(r, "MMM d, yyyy")}
                        </Badge>
                      </div>
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">
                        {school.program}
                        {school.term ? ` · ${admissionTermLabel(school.term)}` : ""}
                      </div>
                      {school.reminderNote?.trim() ? (
                        <p className="mt-2 text-sm text-muted-foreground">
                          {school.reminderNote.trim()}
                        </p>
                      ) : null}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0 gap-2 border-dashed"
                      onClick={() => void clearReminder(school.id)}
                    >
                      <BellOff className="h-4 w-4" aria-hidden />
                      Clear reminder
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="glass-panel border-white/10">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary" aria-hidden />
            <CardTitle className="font-display text-lg">Deadlines</CardTitle>
          </div>
          <CardDescription>
            Sorted soonest first. Rows with no application date appear at the end.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8 pt-2">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading deadlines…</p>
          ) : schools.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No schools yet —{" "}
              <Link href="/schools" className="text-primary underline-offset-4 hover:underline">
                add programs
              </Link>{" "}
              with deadlines to populate your calendar.
            </p>
          ) : (
            <>
              {scheduled.monthKeys.map((key) => {
                const bucket = scheduled.byMonth.get(key)!;
                const labelMonth = startOfMonth(new Date(bucket[0].deadline!));
                return (
                  <section key={key} className="space-y-3">
                    <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      {format(labelMonth, "MMMM yyyy")}
                    </h2>
                    <ul className="space-y-2">
                      {bucket.map((school) => {
                        const d = new Date(school.deadline!);
                        const u = deadlineUrgency(d);
                        const meta = deadlineDueMeta(d);
                        return (
                          <li key={school.id}>
                            <Link
                              href="/schools"
                              className={cn(
                                "flex flex-col gap-2 rounded-xl border bg-muted/25 px-4 py-3 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between",
                                meta.isOverdue
                                  ? "border-red-500/45 bg-red-950/[0.18]"
                                  : "border-white/10",
                              )}
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-display font-semibold leading-tight">
                                    {school.name}
                                  </span>
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      "font-normal tabular-nums",
                                      u.tone === "destructive" &&
                                        "border-red-500/40 bg-red-500/10 text-red-100",
                                      u.tone === "amber" &&
                                        "border-amber-500/35 bg-amber-500/10 text-amber-100",
                                      u.tone === "muted" &&
                                        "border-white/15 text-muted-foreground",
                                    )}
                                  >
                                    {u.label}
                                  </Badge>
                                </div>
                                <div className="mt-1 text-sm text-muted-foreground">
                                  {school.program} · {school.degree}
                                  {school.term ? ` · ${admissionTermLabel(school.term)}` : ""}
                                </div>
                              </div>
                              <div className="flex shrink-0 flex-wrap items-center gap-3 text-sm">
                                <time
                                  dateTime={school.deadline!}
                                  className={cn(
                                    "tabular-nums text-muted-foreground",
                                    meta.isOverdue && "font-medium text-red-200",
                                  )}
                                >
                                  {format(d, "EEE MMM d")}
                                </time>
                                <ChevronRight className="hidden h-4 w-4 text-muted-foreground sm:block" aria-hidden />
                              </div>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                );
              })}

              {scheduled.noDl.length > 0 ? (
                <section className="space-y-3">
                  <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    No deadline set
                  </h2>
                  <ul className="space-y-2">
                    {scheduled.noDl.map((school) => (
                      <li
                        key={school.id}
                        className="rounded-xl border border-dashed border-white/15 bg-muted/15 px-4 py-3 text-sm"
                      >
                        <div className="font-medium">{school.name}</div>
                        <div className="text-muted-foreground">
                          {school.program} — add a date on{" "}
                          <Link
                            href="/schools"
                            className="text-primary underline-offset-4 hover:underline"
                          >
                            Schools
                          </Link>{" "}
                          to surface it above.
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
