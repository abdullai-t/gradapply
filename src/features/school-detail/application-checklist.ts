import type { SchoolRow } from "@/features/schools/types";
import type { SopVariantRow } from "@/features/sop-studio/api";

export type ChecklistItem = {
  id: string;
  label: string;
  detail: string;
  done: boolean;
  href?: string;
  icon: string;
};

export function buildApplicationChecklist(
  school: SchoolRow,
  variant: SopVariantRow | null | undefined,
  profDraftCount: number,
): ChecklistItem[] {
  const programComplete = Boolean(
    school.program?.trim() && school.degree?.trim(),
  );
  const hasSop =
    Boolean(variant?.body?.trim()) && (variant?.body.trim().length ?? 0) >= 80;
  const submitted =
    school.status === "APPLIED" ||
    school.status === "WAITING" ||
    school.status === "ACCEPTED" ||
    school.status === "REJECTED";

  return [
    {
      id: "program",
      label: "Program details",
      detail: programComplete
        ? `${school.program} · ${school.degree}`
        : "Add program and degree on this page",
      done: programComplete,
      icon: "school",
    },
    {
      id: "deadline",
      label: "Application deadline",
      detail: school.deadline
        ? "Deadline saved — visible on Timeline"
        : "Set a deadline to track urgency",
      done: Boolean(school.deadline),
      icon: "event",
    },
    {
      id: "portal",
      label: "Portal link",
      detail: school.portalUrl?.trim()
        ? "Application portal on file"
        : "Save your grad-school application URL",
      done: Boolean(school.portalUrl?.trim()),
      icon: "link",
    },
    {
      id: "sop",
      label: "SOP studio draft",
      detail: hasSop
        ? variant?.title ?? "Draft saved — mark Personal Statement in tracker when ready"
        : "Generate a school-specific statement in SOP studio",
      done: hasSop,
      href: `/assistant?mode=sop&schoolId=${school.id}`,
      icon: "description",
    },
    {
      id: "faculty",
      label: "Faculty outreach",
      detail:
        profDraftCount > 0
          ? `${profDraftCount} professor draft${profDraftCount === 1 ? "" : "s"} linked`
          : "Draft emails to faculty at this institution",
      done: profDraftCount > 0,
      href: "/emails",
      icon: "mail",
    },
    {
      id: "submit",
      label: "Application submitted",
      detail: submitted
        ? `Status: ${school.status.replaceAll("_", " ").toLowerCase()}`
        : "Update status when you submit",
      done: submitted,
      icon: "check_circle",
    },
  ];
}

export function checklistCompletionPercent(items: ChecklistItem[]): number {
  if (items.length === 0) return 0;
  const done = items.filter((i) => i.done).length;
  return Math.round((done / items.length) * 100);
}
