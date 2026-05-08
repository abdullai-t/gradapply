"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { PageLoader } from "@/components/page-loader";

// Add-school modal is dynamically imported so it doesn't bloat the initial
// /schools route bundle. Renders only after a FAB / button gesture, so SSR
// is not required.
const AddSchoolModal = dynamic(
  () =>
    import("@/components/add-school-modal").then((m) => ({
      default: m.AddSchoolModal,
    })),
  { ssr: false },
);

import { SchoolsStats } from "@/features/schools/schools-stats";
import { SchoolGridCard } from "@/features/schools/school-grid-card";
import { SchoolDetailForm } from "@/features/schools/school-detail-form";
import { AddSchoolCard } from "@/features/schools/add-school-card";
import { AIInsightCard } from "@/features/schools/ai-insight-card";
import {
  schoolsKeys,
  useDeleteSchool,
  useSchools,
  useUpdateSchool,
} from "@/features/schools/api";
import type { SchoolRow } from "@/features/schools/types";

export default function SchoolsPage() {
  const searchParams = useSearchParams();
  const qc = useQueryClient();
  const { data, isLoading } = useSchools();
  const updateSchool = useUpdateSchool();
  const deleteSchoolMutation = useDeleteSchool();
  const schools = useMemo(() => (data ?? []) as SchoolRow[], [data]);

  // Bridge for the legacy AddSchoolModal which POSTs directly. It invokes
  // `onSaved` after a successful write; we forward that to TanStack Query
  // as a cache invalidation.
  const invalidateSchools = () =>
    void qc.invalidateQueries({ queryKey: schoolsKeys.all });

  const [addOpen, setAddOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const linkedSchoolId = searchParams.get("schoolId");

  const sorted = useMemo(
    () =>
      [...schools].sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      ),
    [schools],
  );

  useEffect(() => {
    if (!linkedSchoolId) return;
    const exists = schools.some((s) => s.id === linkedSchoolId);
    if (exists) setExpandedId(linkedSchoolId);
  }, [linkedSchoolId, schools]);

  const patchSchool = (
    id: string,
    body: Partial<SchoolRow> & Record<string, unknown>,
  ) => updateSchool.mutateAsync({ id, data: body });

  const deleteSchool = async (id: string) => {
    if (!confirm("Delete this school record?")) return;
    if (expandedId === id) setExpandedId(null);
    await deleteSchoolMutation.mutateAsync(id);
  };

  const toggleExpanded = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="slide-in space-y-10 pb-8">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="t-headline-lg m-0 text-[var(--on-surface)]">
            School applications
          </h1>
          <p className="mt-1.5 text-[15px] text-[var(--on-surface-variant)]">
            Track your journey and manage deadlines across every program.
          </p>
        </div>
        <Button icon="add" size="lg" onClick={() => setAddOpen(true)}>
          Add school
        </Button>
      </header>

      {/* Stats bento */}
      <SchoolsStats schools={schools} />

      {/* Grid */}
      {isLoading ? (
        <PageLoader label="Loading schools…" />
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {sorted.map((school) => (
            <SchoolGridCard
              key={school.id}
              school={school}
              expanded={expandedId === school.id}
              onToggleExpand={() => toggleExpanded(school.id)}
              onDelete={() => deleteSchool(school.id)}
            >
              <SchoolDetailForm
                school={school}
                onPatch={(body) => patchSchool(school.id, body)}
              />
            </SchoolGridCard>
          ))}
          <AddSchoolCard onClick={() => setAddOpen(true)} />
        </div>
      )}

      {/* AI insight */}
      {!isLoading && schools.length > 0 ? (
        <AIInsightCard schools={schools} />
      ) : null}

      {/* Modals */}
      <AddSchoolModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSaved={invalidateSchools}
      />
    </div>
  );
}
