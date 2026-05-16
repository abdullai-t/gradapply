"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from "react";
import dynamic from "next/dynamic";
import { useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";

import { messageFromApiErrorPayload } from "@/lib/api-error-json";

import { Button } from "@/components/ui/button";
import { PageLoader } from "@/components/page-loader";

// Add-school modal is dynamically imported so it doesn't bloat the initial
// /schools route bundle. Renders only after a FAB / button gesture, so SSR
// is not required.
const AddSchoolModal = dynamic(
  () =>
    import("@/components/add-school-modal").then((m) => ({
      default: m.AddSchoolModal as ComponentType<{
        open: boolean;
        onClose: () => void;
        onSaved: () => void;
      }>,
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

function SchoolsPageInner() {
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const schoolIdFromUrl = searchParams.get("schoolId");

  const { data, isLoading, isFetched } = useSchools();
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
  const [linkedSchoolId, setLinkedSchoolId] = useState<string | null>(null);
  const [suggestingSchoolId, setSuggestingSchoolId] = useState<string | null>(null);
  const scrolledToDeepLinkRef = useRef<string | null>(null);

  const sorted = useMemo(
    () =>
      [...schools].sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      ),
    [schools],
  );

  useEffect(() => {
    setLinkedSchoolId(schoolIdFromUrl);
  }, [schoolIdFromUrl]);

  useEffect(() => {
    scrolledToDeepLinkRef.current = null;
  }, [linkedSchoolId]);

  useEffect(() => {
    if (!linkedSchoolId || !isFetched || isLoading) return;
    const exists = schools.some((s) => s.id === linkedSchoolId);
    if (!exists) return;
    setExpandedId(linkedSchoolId);

    if (scrolledToDeepLinkRef.current === linkedSchoolId) return;

    const id = linkedSchoolId;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = document.getElementById(`school-card-${id}`);
        if (el) {
          scrolledToDeepLinkRef.current = linkedSchoolId;
          el.scrollIntoView({
            behavior: "smooth",
            block: "start",
            inline: "nearest",
          });
          return;
        }
        window.setTimeout(() => {
          const el2 = document.getElementById(`school-card-${id}`);
          if (!el2) return;
          scrolledToDeepLinkRef.current = linkedSchoolId;
          el2.scrollIntoView({
            behavior: "smooth",
            block: "start",
            inline: "nearest",
          });
        }, 120);
      });
    });
  }, [linkedSchoolId, schools, isFetched, isLoading]);

  const patchSchool = (
    id: string,
    body: Partial<SchoolRow> & Record<string, unknown>,
  ) => updateSchool.mutateAsync({ id, data: body });

  const suggestSchoolDetailsWithAi = useCallback(
    async (school: SchoolRow) => {
      setSuggestingSchoolId(school.id);
      try {
        const res = await fetch("/api/schools/infer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ schoolId: school.id }),
        });
        const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        if (!res.ok) {
          throw new Error(messageFromApiErrorPayload(data));
        }

        const patch: Partial<SchoolRow> & Record<string, unknown> = {};
        if (typeof data.program === "string" && data.program.trim()) {
          patch.program = data.program.trim();
        }
        if (typeof data.degree === "string" && data.degree.trim()) {
          patch.degree = data.degree.trim();
        }
        if (typeof data.country === "string" && data.country.trim()) {
          patch.country = data.country.trim();
        }
        const term = data.term;
        if (term === "FALL" || term === "SPRING" || term === "SUMMER") {
          patch.term = term;
        }
        if (typeof data.deadline === "string" && data.deadline.trim()) {
          patch.deadline = data.deadline.trim();
        }
        if (typeof data.funding === "string" && data.funding.trim()) {
          patch.funding = data.funding.trim();
        }
        if (typeof data.notes === "string" && data.notes.trim()) {
          patch.notes = data.notes.trim();
        }
        if (typeof data.portalUrl === "string" && data.portalUrl.trim()) {
          patch.portalUrl = data.portalUrl.trim();
        }

        if (Object.keys(patch).length === 0) {
          alert(
            "AI did not return enough confident details to update this school. You can try again or edit fields manually.",
          );
          return;
        }

        await updateSchool.mutateAsync({ id: school.id, data: patch });
      } catch (e) {
        alert(e instanceof Error ? e.message : "Suggest failed");
      } finally {
        setSuggestingSchoolId(null);
      }
    },
    [updateSchool],
  );

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
              onAiSuggestDetails={() => suggestSchoolDetailsWithAi(school)}
              aiSuggestDetailsLoading={suggestingSchoolId === school.id}
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

export default function SchoolsPage() {
  return (
    <Suspense fallback={<PageLoader label="Loading schools…" />}>
      <SchoolsPageInner />
    </Suspense>
  );
}
