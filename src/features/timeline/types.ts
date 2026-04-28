import type { AdmissionTerm } from "@prisma/client";

export type TimelineSchool = {
  id: string;
  name: string;
  program: string;
  degree: string;
  country: string | null;
  term: AdmissionTerm | null;
  deadline: string | null;
  reminderAt: string | null;
  reminderNote: string | null;
  portalUrl: string | null;
  updatedAt: string;
};
