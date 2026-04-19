"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ChevronRight, ExternalLink, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AddSchoolModal } from "@/components/add-school-modal";
import {
  ADMISSION_TERM_OPTIONS,
  admissionTermLabel,
} from "@/lib/admission-term";
import { progressFromStatus } from "@/lib/school-progress";
import { cn } from "@/lib/utils";
import type { AdmissionTerm } from "@prisma/client";

type SchoolStatus =
  | "PLANNING"
  | "APPLIED"
  | "WAITING"
  | "ACCEPTED"
  | "REJECTED"
  | "WITHDRAWN";

type SchoolRow = {
  id: string;
  name: string;
  program: string;
  degree: string;
  country: string | null;
  term: AdmissionTerm | null;
  deadline: string | null;
  status: SchoolStatus;
  funding: string | null;
  notes: string | null;
  portalUrl: string | null;
  progress: number;
  updatedAt: string;
};

const statuses: SchoolStatus[] = [
  "PLANNING",
  "APPLIED",
  "WAITING",
  "ACCEPTED",
  "REJECTED",
  "WITHDRAWN",
];

const TERM_SELECT_NONE = "__term_none__";

export default function SchoolsPage() {
  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  /** Expanded school cards — omitted id = collapsed (minimal). */
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/schools");
    if (res.ok) setSchools(await res.json());
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const sorted = useMemo(
    () =>
      [...schools].sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      ),
    [schools],
  );

  const patchSchool = async (id: string, body: Partial<SchoolRow>) => {
    const res = await fetch(`/api/schools/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) await load();
  };

  const deleteSchool = async (id: string) => {
    if (!confirm("Delete this school record?")) return;
    const res = await fetch(`/api/schools/${id}`, { method: "DELETE" });
    if (res.ok) await load();
  };

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-24">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Schools</h1>
        <p className="text-muted-foreground">
          Track programs, deadlines, portals, and status as you move from planning to
          applied.
        </p>
      </div>

      <Card className="glass-panel border-white/10">
        <CardHeader>
          <CardTitle>Your schools</CardTitle>
          <CardDescription>
            Tap a row to expand editing details; collapsed rows show a quick summary. Use the
            floating button to add a school.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading schools…</div>
          ) : sorted.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No schools yet — tap the add button to create your first entry.
            </div>
          ) : (
            sorted.map((school) => {
              const progressPct = progressFromStatus(school.status);
              const isOpen = expanded[school.id] === true;
              const summaryBits = [
                school.country,
                school.term ? admissionTermLabel(school.term) : null,
                school.deadline
                  ? `Due ${format(new Date(school.deadline), "MMM d, yyyy")}`
                  : null,
              ].filter(Boolean);

              return (
                <div
                  key={school.id}
                  className="rounded-xl border border-white/10 bg-muted/30 shadow-sm backdrop-blur-sm"
                >
                  <div className="flex gap-2 p-3 sm:p-4">
                    <button
                      type="button"
                      className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-muted-foreground transition-colors hover:bg-white/[0.08] hover:text-foreground"
                      aria-expanded={isOpen}
                      aria-controls={`school-panel-${school.id}`}
                      id={`school-trigger-${school.id}`}
                      onClick={() => toggleExpanded(school.id)}
                      aria-label={isOpen ? "Collapse details" : "Expand details"}
                    >
                      <ChevronRight
                        className={cn(
                          "h-5 w-5 transition-transform duration-200",
                          isOpen && "rotate-90",
                        )}
                        aria-hidden
                      />
                    </button>

                    <button
                      type="button"
                      className="min-w-0 flex-1 cursor-pointer rounded-lg text-left outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => toggleExpanded(school.id)}
                      aria-expanded={isOpen}
                      aria-controls={`school-panel-${school.id}`}
                    >
                      <div className="font-display text-lg font-semibold leading-tight">
                        {school.name}
                      </div>
                      <div className="mt-0.5 text-sm text-muted-foreground">
                        {school.program} · {school.degree}
                      </div>
                      {!isOpen && summaryBits.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          {summaryBits.map((bit, i) => (
                            <span key={`${school.id}-s-${i}`}>{bit}</span>
                          ))}
                        </div>
                      ) : null}
                    </button>

                    <div className="flex shrink-0 items-start gap-2">
                      <Badge variant="outline" className="hidden sm:inline-flex">
                        {school.status.replaceAll("_", " ")}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0"
                        aria-label="Delete school"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteSchool(school.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {!isOpen ? (
                    <Badge
                      variant="outline"
                      className="mx-4 mb-3 ml-[4.25rem] sm:hidden"
                    >
                      {school.status.replaceAll("_", " ")}
                    </Badge>
                  ) : null}

                  {isOpen ? (
                    <div
                      id={`school-panel-${school.id}`}
                      role="region"
                      aria-labelledby={`school-trigger-${school.id}`}
                      className="border-t border-white/10"
                    >
                      <div className="space-y-4 px-4 pb-4 pt-3 sm:pl-[4.25rem]">
                        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground sm:text-sm">
                          {school.country ? (
                            <span>{school.country}</span>
                          ) : (
                            <span className="italic">No country set</span>
                          )}
                          {school.term ? (
                            <span>Term: {admissionTermLabel(school.term)}</span>
                          ) : (
                            <span className="italic">No term set</span>
                          )}
                          {school.deadline ? (
                            <span>
                              Deadline{" "}
                              {format(new Date(school.deadline), "MMM d, yyyy")}
                            </span>
                          ) : (
                            <span className="italic">No deadline</span>
                          )}
                          {school.funding?.trim() ? (
                            <span>Funding: {school.funding}</span>
                          ) : null}
                          {school.portalUrl?.trim() ? (
                            <a
                              href={school.portalUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              Application portal
                              <ExternalLink className="h-3 w-3" aria-hidden />
                            </a>
                          ) : null}
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label>Admission term</Label>
                            <Select
                              value={
                                school.term != null ? school.term : TERM_SELECT_NONE
                              }
                              onValueChange={(v) =>
                                patchSchool(school.id, {
                                  term:
                                    v === TERM_SELECT_NONE
                                      ? null
                                      : (v as AdmissionTerm),
                                })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Term" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={TERM_SELECT_NONE}>
                                  Not specified
                                </SelectItem>
                                {ADMISSION_TERM_OPTIONS.map(({ value, label }) => (
                                  <SelectItem key={value} value={value}>
                                    {label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Status</Label>
                            <Select
                              value={school.status}
                              onValueChange={(v) =>
                                patchSchool(school.id, {
                                  status: v as SchoolStatus,
                                })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {statuses.map((s) => (
                                  <SelectItem key={s} value={s}>
                                    {s.replaceAll("_", " ")}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Progress ({progressPct}%)</Label>
                            <Progress value={progressPct} />
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <Label>Notes</Label>
                            <Textarea
                              defaultValue={school.notes ?? ""}
                              onBlur={(e) =>
                                patchSchool(school.id, {
                                  notes: e.target.value,
                                })
                              }
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Button
        type="button"
        size="icon"
        className="fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full shadow-lg"
        aria-label="Add school"
        onClick={() => setAddOpen(true)}
      >
        <Plus className="h-7 w-7" aria-hidden />
      </Button>

      <AddSchoolModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSaved={() => void load()}
      />
    </div>
  );
}
