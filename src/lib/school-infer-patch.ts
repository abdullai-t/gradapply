import type { SchoolRow } from "@/features/schools/types";
import { pickInferApplicationFee } from "@/lib/school-infer-application-fee";
import {
  materialsFromInferLabels,
  parseInferLettersRequired,
  parseInferMaterialLabels,
  recommendersFromInferCount,
} from "@/lib/school-tracker-defaults";

/**
 * Turn POST /api/schools/infer JSON into a PATCH body for School.
 * Pass `existing` when updating a saved school so checklist `done` states merge.
 */
export function buildSchoolPatchFromInfer(
  data: Record<string, unknown>,
  existing?: Pick<
    SchoolRow,
    | "requiredMaterials"
    | "letterRecommenders"
    | "notes"
    | "program"
    | "degree"
    | "country"
    | "term"
    | "deadline"
    | "funding"
    | "applicationFee"
    | "portalUrl"
    | "programUrl"
    | "department"
    | "college"
    | "primaryProfessor"
    | "backupProfessors"
  >,
): Partial<SchoolRow> & Record<string, unknown> {
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
  const applicationFee = pickInferApplicationFee(data);
  if (applicationFee) {
    patch.applicationFee = applicationFee;
  }
  if (typeof data.portalUrl === "string" && data.portalUrl.trim()) {
    patch.portalUrl = data.portalUrl.trim();
  }
  if (typeof data.programUrl === "string" && data.programUrl.trim()) {
    patch.programUrl = data.programUrl.trim();
  }
  if (typeof data.department === "string" && data.department.trim()) {
    patch.department = data.department.trim();
  }
  if (typeof data.college === "string" && data.college.trim()) {
    patch.college = data.college.trim();
  }
  if (typeof data.primaryProfessor === "string" && data.primaryProfessor.trim()) {
    patch.primaryProfessor = data.primaryProfessor.trim();
  }
  if (typeof data.backupProfessors === "string" && data.backupProfessors.trim()) {
    patch.backupProfessors = data.backupProfessors.trim();
  }

  const materialLabels = parseInferMaterialLabels(
    data.requiredMaterialLabels ?? data.requiredMaterials,
  );
  if (materialLabels.length > 0) {
    patch.requiredMaterials = materialsFromInferLabels(
      materialLabels,
      existing?.requiredMaterials ?? [],
    );
  }

  const lettersRequired = parseInferLettersRequired(
    data.lettersRequired ?? data.letterCount,
  );
  if (lettersRequired != null && lettersRequired > 0) {
    patch.letterRecommenders = recommendersFromInferCount(
      lettersRequired,
      existing?.letterRecommenders ?? [],
    );
  }

  const inferNotes =
    typeof data.notes === "string" ? data.notes.trim() : "";
  const requirementsSummary =
    typeof data.applicationRequirementsSummary === "string"
      ? data.applicationRequirementsSummary.trim()
      : "";

  const noteParts = [inferNotes, requirementsSummary].filter(Boolean);
  if (noteParts.length > 0) {
    const combined = noteParts.join("\n\n");
    const prior = existing?.notes?.trim();
    if (!prior) {
      patch.notes = combined;
    } else if (!prior.includes(combined.slice(0, 40))) {
      patch.notes = `${prior}\n\n---\nAI requirements (${new Date().toISOString().slice(0, 10)}):\n${combined}`;
    }
  }

  return patch;
}

export async function fetchSchoolInfer(input: {
  schoolId?: string;
  name?: string;
  term?: SchoolRow["term"];
}): Promise<Record<string, unknown>> {
  const res = await fetch("/api/schools/infer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown> & {
    error?: unknown;
  };
  if (!res.ok) {
    const msg =
      typeof data.error === "string"
        ? data.error
        : typeof data.error === "object" && data.error !== null
          ? JSON.stringify(data.error)
          : `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data;
}
