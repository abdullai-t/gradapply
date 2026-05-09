import type { AdmissionTerm } from "@prisma/client";

export const ADMISSION_TERM_OPTIONS: {
  value: AdmissionTerm;
  label: string;
}[] = [
  { value: "FALL", label: "Fall" },
  { value: "SPRING", label: "Spring" },
  { value: "SUMMER", label: "Summer" },
];

export function admissionTermLabel(term: AdmissionTerm | null | undefined): string {
  if (!term) return "";
  const row = ADMISSION_TERM_OPTIONS.find((o) => o.value === term);
  return row?.label ?? term;
}
