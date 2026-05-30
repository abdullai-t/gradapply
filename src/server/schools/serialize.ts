import type { School } from "@prisma/client";

import {
  normalizeLetterRecommenders,
  normalizeRequiredMaterials,
  type LetterRecommenderItem,
  type RequiredMaterialItem,
} from "@/lib/school-tracker-defaults";

export type SerializedSchool = Omit<
  School,
  "deadline" | "reminderAt" | "createdAt" | "updatedAt" | "requiredMaterials" | "letterRecommenders"
> & {
  deadline: string | null;
  reminderAt: string | null;
  createdAt: string;
  updatedAt: string;
  requiredMaterials: RequiredMaterialItem[];
  letterRecommenders: LetterRecommenderItem[];
};

function iso(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d.toISOString();
}

export function serializeSchool(row: School): SerializedSchool {
  return {
    ...row,
    deadline: iso(row.deadline),
    reminderAt: iso(row.reminderAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    requiredMaterials: normalizeRequiredMaterials(row.requiredMaterials),
    letterRecommenders: normalizeLetterRecommenders(row.letterRecommenders),
  };
}

export function serializeSchools(rows: School[]): SerializedSchool[] {
  return rows.map(serializeSchool);
}
