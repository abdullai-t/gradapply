import { describe, expect, it } from "vitest";

import {
  normalizeLetterRecommenders,
  normalizeRequiredMaterials,
  type LetterRecommenderItem,
  type RequiredMaterialItem,
} from "@/lib/school-tracker-defaults";
import { serializeSchool } from "@/server/schools/serialize";
import type { School } from "@prisma/client";
import { SchoolStatus } from "@prisma/client";

describe("normalizeRequiredMaterials", () => {
  it("returns empty array when stored value is null", () => {
    expect(normalizeRequiredMaterials(null)).toEqual([]);
  });

  it("returns empty array when the user removed every material", () => {
    expect(normalizeRequiredMaterials([])).toEqual([]);
  });

  it("does not re-add default rows after the user removes them", () => {
    const saved: RequiredMaterialItem[] = [
      { id: "m1", label: "Personal Statement", done: false },
      { id: "m2", label: "Transcripts", done: true },
    ];
    const result = normalizeRequiredMaterials(saved);
    expect(result).toEqual(saved);
    expect(result.some((m) => m.label === "Res/CV")).toBe(false);
  });

  it("preserves AI-inferred extras after removal of another item", () => {
    const saved: RequiredMaterialItem[] = [
      { id: "m1", label: "GRE scores (for international applicants)", done: false },
      { id: "m2", label: "Statement of purpose", done: false },
    ];
    const result = normalizeRequiredMaterials(saved);
    expect(result).toHaveLength(2);
    expect(result.map((m) => m.label)).toEqual([
      "GRE scores (for international applicants)",
      "Statement of purpose",
    ]);
  });
  it("returns empty array when stored value is invalid", () => {
    expect(normalizeRequiredMaterials("not-an-array")).toEqual([]);
    expect(normalizeRequiredMaterials([{ bad: true }])).toEqual([]);
  });
});

describe("normalizeLetterRecommenders", () => {
  it("returns saved recommenders without padding removed slots", () => {
    const saved: LetterRecommenderItem[] = [
      { id: "l1", name: "Dr. Smith", done: true },
      { id: "l2", name: "Prof. Lee", done: false },
    ];
    expect(normalizeLetterRecommenders(saved)).toEqual(saved);
  });

  it("returns empty array when stored value is empty", () => {
    expect(normalizeLetterRecommenders([])).toEqual([]);
  });

  it("returns empty array when stored value is null", () => {
    expect(normalizeLetterRecommenders(null)).toEqual([]);
  });
});

describe("serializeSchool tracker fields", () => {
  const baseRow = {
    id: "school-1",
    userId: "user-1",
    name: "Test U",
    program: "CS PhD",
    degree: "PhD",
    country: "US",
    term: "FALL",
    deadline: null,
    status: SchoolStatus.PLANNING,
    funding: null,
    applicationFee: null,
    notes: null,
    portalUrl: null,
    programUrl: null,
    department: null,
    college: null,
    primaryProfessor: null,
    backupProfessors: null,
    progress: 0,
    reminderAt: null,
    reminderNote: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-02"),
  } satisfies Omit<School, "requiredMaterials" | "letterRecommenders">;

  it("serializes requiredMaterials without resurrecting deleted defaults", () => {
    const row: School = {
      ...baseRow,
      requiredMaterials: [
        { id: "m1", label: "Personal Statement", done: false },
      ],
      letterRecommenders: [{ id: "l1", name: "Dr. A", done: false }],
    };
    const serialized = serializeSchool(row);
    expect(serialized.requiredMaterials).toEqual([
      { id: "m1", label: "Personal Statement", done: false },
    ]);
  });

  it("serializes empty tracker lists as stored", () => {
    const row: School = {
      ...baseRow,
      requiredMaterials: [],
      letterRecommenders: [],
    };
    const serialized = serializeSchool(row);
    expect(serialized.requiredMaterials).toEqual([]);
    expect(serialized.letterRecommenders).toEqual([]);
  });

  it("serializes letterRecommenders as stored", () => {
    const letters = [{ id: "l1", name: "Dr. A", done: false }];
    const row: School = {
      ...baseRow,
      requiredMaterials: [{ id: "m1", label: "Transcripts", done: false }],
      letterRecommenders: letters,
    };
    expect(serializeSchool(row).letterRecommenders).toEqual(letters);
  });
});
