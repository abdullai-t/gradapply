/**
 * Row shapes for UI (Mongoose lean maps to plain objects). Prefer these over
 * removed `@prisma/client` model types.
 */

import type { AdmissionTerm, SchoolStatus } from "@/types/enums";

export type User = Record<string, unknown> & { id: string };

/** Profile fields used by dashboard completeness and missions. */
export type Profile = Record<string, unknown> & {
  userId?: string;
  targetDegree?: string | null;
  focusArea?: string | null;
  researchInterests?: string | null;
  bio?: string | null;
};

/** Shortlisted school card + dashboard lists. */
export type School = {
  id: string;
  name: string;
  program: string;
  degree: string;
  status: SchoolStatus;
  term?: AdmissionTerm | null;
  deadline?: Date | string | null;
  funding?: string | null;
  updatedAt?: Date | string;
  reminderAt?: Date | string | null;
};
