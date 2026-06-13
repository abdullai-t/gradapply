/**
 * Dev-only preview of the new tactile /schools page using mocked data.
 * Skips Prisma + auth so we can verify the visual without a real account.
 * Returns 404 in production.
 */
"use client";

import { notFound } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/confirm-dialog";
import { Sidebar } from "@/features/shell/sidebar";
import { TopBar } from "@/features/shell/topbar";
import { FAB } from "@/features/shell/fab";
import { MobileNav } from "@/features/shell/mobile-nav";
import { SchoolsStats } from "@/features/schools/schools-stats";
import { SchoolGridCard } from "@/features/schools/school-grid-card";
import { SchoolDetailForm } from "@/features/schools/school-detail-form";
import { AddSchoolCard } from "@/features/schools/add-school-card";
import { AIInsightCard } from "@/features/schools/ai-insight-card";
import {
  defaultLetterRecommenders,
  defaultRequiredMaterials,
} from "@/lib/school-tracker-defaults";
import type { SchoolRow } from "@/features/schools/types";

const TRACKER_DEFAULTS = {
  programUrl: null,
  department: null,
  college: null,
  primaryProfessor: null,
  backupProfessors: null,
  requiredMaterials: defaultRequiredMaterials(),
  letterRecommenders: defaultLetterRecommenders(),
} as const;

const MOCK_SCHOOLS: SchoolRow[] = [
  {
    id: "stanford",
    name: "Stanford University",
    program: "MS in Artificial Intelligence",
    degree: "MS",
    country: "United States",
    term: "FALL",
    deadline: "2025-12-15T00:00:00.000Z",
    status: "PLANNING",
    funding: "Need to apply for fellowships",
    applicationFee: "$125",
    notes: "Top dream — focus the SOP on Fei-Fei's vision lab work.",
    portalUrl: "https://gradadmissions.stanford.edu",
    ...TRACKER_DEFAULTS,
    department: "Computer Science",
    college: "School of Engineering",
    progress: 65,
    reminderAt: null,
    reminderNote: null,
    updatedAt: new Date().toISOString(),
  },
  {
    id: "mit",
    name: "MIT",
    program: "Ph.D. in Computer Science",
    degree: "PhD",
    country: "United States",
    term: "FALL",
    deadline: "2025-11-01T00:00:00.000Z",
    status: "APPLIED",
    funding: "Funded — full stipend",
    applicationFee: "$75",
    notes: null,
    portalUrl: null,
    ...TRACKER_DEFAULTS,
    progress: 100,
    reminderAt: null,
    reminderNote: null,
    updatedAt: new Date().toISOString(),
  },
  {
    id: "eth",
    name: "ETH Zurich",
    program: "MSc in Data Science",
    degree: "MSc",
    country: "Switzerland",
    term: "FALL",
    deadline: "2025-12-01T00:00:00.000Z",
    status: "WAITING",
    funding: null,
    applicationFee: null,
    notes: null,
    portalUrl: null,
    ...TRACKER_DEFAULTS,
    progress: 30,
    reminderAt: null,
    reminderNote: null,
    updatedAt: new Date().toISOString(),
  },
  {
    id: "cmu",
    name: "Carnegie Mellon",
    program: "MS in Machine Learning",
    degree: "MS",
    country: "United States",
    term: "FALL",
    deadline: "2025-12-20T00:00:00.000Z",
    status: "ACCEPTED",
    funding: "Tuition waiver",
    applicationFee: "$80",
    notes: "Acceptance email arrived 11/12 — celebrate before pivoting.",
    portalUrl: null,
    ...TRACKER_DEFAULTS,
    progress: 100,
    reminderAt: null,
    reminderNote: null,
    updatedAt: new Date().toISOString(),
  },
];

export default function PreviewSchoolsPage() {
  const confirm = useConfirm();
  const [schools, setSchools] = useState<SchoolRow[]>(MOCK_SCHOOLS);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  if (process.env.NODE_ENV === "production") notFound();

  function patchSchool(id: string, body: Partial<SchoolRow>) {
    setSchools((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...body } : s)),
    );
  }
  async function deleteSchool(id: string) {
    const ok = await confirm({
      title: "Delete this school?",
      description: "This removes the school record from your list.",
      variant: "destructive",
    });
    if (!ok) return;
    setSchools((prev) => prev.filter((s) => s.id !== id));
    if (expandedId === id) setExpandedId(null);
  }
  function toggleExpanded(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  return (
    <div className="relative min-h-screen md:flex bg-[var(--background)] text-[var(--on-background)]">
      <Sidebar />
      <div className="flex min-h-screen flex-1 flex-col">
        <TopBar />
        <main
          className="flex-1 px-4 py-6 md:px-8 md:py-8 pb-24 md:pb-12"
          style={{ maxWidth: "1320px", margin: "0 auto", width: "100%" }}
        >
          <div className="slide-in space-y-10 pb-8">
            <header className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="t-headline-lg m-0 text-[var(--on-surface)]">
                  School applications
                </h1>
                <p className="mt-1.5 text-[15px] text-[var(--on-surface-variant)]">
                  Track your journey and manage deadlines across every program.
                </p>
              </div>
              <Button icon="add" size="lg">
                Add school
              </Button>
            </header>

            <SchoolsStats schools={schools} />

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {schools.map((s) => (
                <SchoolGridCard
                  key={s.id}
                  school={s}
                  expanded={expandedId === s.id}
                  onToggleExpand={() => toggleExpanded(s.id)}
                  onDelete={() => deleteSchool(s.id)}
                >
                  <SchoolDetailForm
                    school={s}
                    onPatch={(b) => patchSchool(s.id, b)}
                  />
                </SchoolGridCard>
              ))}
              <AddSchoolCard onClick={() => alert("Add school — preview")} />
            </div>

            <AIInsightCard schools={schools} />

            <div className="mt-12 rounded-3xl border-2 border-dashed border-[var(--outline-variant)] p-6 text-center">
              <p className="t-label-lg">Preview mode · /dev/preview/schools</p>
            </div>
          </div>
        </main>
      </div>
      <MobileNav />
      <FAB />
    </div>
  );
}
