import type { AdmissionTerm } from "@prisma/client";

import type {
  LetterRecommenderItem,
  RequiredMaterialItem,
} from "@/lib/school-tracker-defaults";

export type { LetterRecommenderItem, RequiredMaterialItem };

export type SchoolStatus =
  | "PLANNING"
  | "APPLIED"
  | "WAITING"
  | "ACCEPTED"
  | "REJECTED"
  | "WITHDRAWN";

export type SchoolRow = {
  id: string;
  name: string;
  program: string;
  degree: string;
  country: string | null;
  term: AdmissionTerm | null;
  deadline: string | null;
  status: SchoolStatus;
  funding: string | null;
  applicationFee: string | null;
  notes: string | null;
  portalUrl: string | null;
  programUrl: string | null;
  department: string | null;
  college: string | null;
  primaryProfessor: string | null;
  backupProfessors: string | null;
  requiredMaterials: RequiredMaterialItem[];
  letterRecommenders: LetterRecommenderItem[];
  progress: number;
  reminderAt: string | null;
  reminderNote: string | null;
  updatedAt: string;
};

export const SCHOOL_STATUSES: SchoolStatus[] = [
  "PLANNING",
  "APPLIED",
  "WAITING",
  "ACCEPTED",
  "REJECTED",
  "WITHDRAWN",
];

/**
 * Status-tag mapping for the tactile pill on each school card.
 * `tone` selects the badge color family; `label` is the user-facing copy.
 */
export const STATUS_TAG: Record<
  SchoolStatus,
  { tone: "primary" | "secondary" | "tertiary" | "destructive" | "warning" | "muted"; label: string }
> = {
  PLANNING: { tone: "primary", label: "Planning" },
  APPLIED: { tone: "warning", label: "Applied" },
  WAITING: { tone: "warning", label: "Waiting" },
  ACCEPTED: { tone: "tertiary", label: "Accepted" },
  REJECTED: { tone: "destructive", label: "Rejected" },
  WITHDRAWN: { tone: "muted", label: "Withdrawn" },
};
