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
import { useRouter, useSearchParams } from "next/navigation";

import {
  fetchSchoolInfer,
  applySchoolInferResponse,
} from "@/lib/school-infer-patch";

import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/confirm-dialog";
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

import { SchoolImportExport } from "@/features/schools/school-import-export";
import { SchoolsStats } from "@/features/schools/schools-stats";
import { SchoolGridCard } from "@/features/schools/school-grid-card";
import { SchoolDetailForm } from "@/features/schools/school-detail-form";
import { AddSchoolCard } from "@/features/schools/add-school-card";
import { AIInsightCard } from "@/features/schools/ai-insight-card";
import {
  schoolsKeys,
  syncSchoolInCache,
  useDeleteSchool,
  useSchools,
  useUpdateSchool,
} from "@/features/schools/api";
import type { SchoolRow } from "@/features/schools/types";
import { isMutationPendingForId } from "@/lib/mutation-pending";

function SchoolsPageInner() {
  const qc = useQueryClient();
  const router = useRouter();
  const confirm = useConfirm();
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
    if (schoolIdFromUrl) {
      router.replace(`/schools/${schoolIdFromUrl}`);
      return;
    }
    const hashId =
      typeof window !== "undefined"
        ? window.location.hash.replace(/^#/, "").trim()
        : "";
    if (hashId) {
      router.replace(`/schools/${hashId}`);
      return;
    }
    setLinkedSchoolId(null);
  }, [schoolIdFromUrl, router]);

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
        const data = await fetchSchoolInfer({ schoolId: school.id });
        const saved = await applySchoolInferResponse({
          data,
          existing: school,
          onPatch: (patch) =>
            updateSchool.mutateAsync({ id: school.id, data: patch }),
          onSaved: (row) => syncSchoolInCache(qc, row),
        });

        if (!saved) {
          alert(
            "AI did not return enough confident details to update this school. You can try again or edit fields manually.",
          );
          return;
        }
      } catch (e) {
        alert(e instanceof Error ? e.message : "Suggest failed");
      } finally {
        setSuggestingSchoolId(null);
      }
    },
    [updateSchool, qc],
  );

  const deleteSchool = async (id: string) => {
    const ok = await confirm({
      title: "Delete this school?",
      description: "This removes the school record from your list. This cannot be undone.",
      variant: "destructive",
    });
    if (!ok) return;
    if (expandedId === id) setExpandedId(null);
    void deleteSchoolMutation.mutateAsync(id);
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
        <div className="flex flex-wrap items-center gap-2">
          <SchoolImportExport onImported={invalidateSchools} />
          <Button icon="add" size="lg" onClick={() => setAddOpen(true)}>
            Add school
          </Button>
        </div>
      </header>

      {/* Stats bento */}
      <SchoolsStats schools={schools} />

      {!isLoading && schools.length === 0 ? (
        <section className="tactile-card rounded-3xl border-2 border-dashed border-[var(--outline-variant)] p-8 text-center md:p-12">
          <h2 className="m-0 text-xl font-bold text-[var(--on-surface)]">
            Build your school list
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[var(--on-surface-variant)]">
            Add programs manually or let AI suggest reach, match, and safety
            schools based on your profile.
          </p>
          <Button
            className="mt-6"
            size="lg"
            icon="auto_awesome"
            onClick={() => setAddOpen(true)}
          >
            Get recommendations
          </Button>
        </section>
      ) : null}

      {/* Grid */}
      {isLoading ? (
        <PageLoader label="Loading schools…" />
      ) : schools.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {sorted.map((school) => (
            <SchoolGridCard
              key={school.id}
              school={school}
              expanded={expandedId === school.id}
              onToggleExpand={() => toggleExpanded(school.id)}
              onDelete={() => deleteSchool(school.id)}
              deleteLoading={isMutationPendingForId(deleteSchoolMutation, school.id)}
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
      ) : null}

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
