import { describe, expect, it } from "vitest";

import {
  candidateBelongsToSelectedSchool,
  filterFacultyDiscoveryCandidates,
  isLikelyInactiveFaculty,
  resolveCandidateSchoolId,
} from "@/lib/faculty-discovery-filter";

const schools = [
  { id: "sch-1", name: "University of Example" },
  { id: "sch-2", name: "State Tech Institute" },
];
const known = new Set(schools.map((s) => s.id));

describe("isLikelyInactiveFaculty", () => {
  it("flags emeritus and retired faculty", () => {
    expect(isLikelyInactiveFaculty({ name: "Dr. Jane Doe, Professor Emeritus" })).toBe(
      true,
    );
    expect(
      isLikelyInactiveFaculty({ rationale: "Retired faculty with historical overlap" }),
    ).toBe(true);
  });

  it("allows active faculty descriptions", () => {
    expect(
      isLikelyInactiveFaculty({
        name: "Dr. Alex Chen",
        researchArea: "Machine learning for robotics",
        rationale: "Strong alignment with NLP and vision interests",
      }),
    ).toBe(false);
  });
});

describe("resolveCandidateSchoolId", () => {
  it("prefers a valid schoolId", () => {
    expect(
      resolveCandidateSchoolId({ schoolId: "sch-1" }, schools, known),
    ).toBe("sch-1");
  });

  it("fuzzy-matches university label to selected school", () => {
    expect(
      resolveCandidateSchoolId(
        { university: "Example University" },
        schools,
        known,
      ),
    ).toBe("sch-1");
  });

  it("returns undefined for unrelated institutions", () => {
    expect(
      resolveCandidateSchoolId(
        { university: "Harvard University" },
        schools,
        known,
      ),
    ).toBeUndefined();
  });
});

describe("candidateBelongsToSelectedSchool", () => {
  it("accepts matched school via id or name", () => {
    expect(
      candidateBelongsToSelectedSchool({ schoolId: "sch-2" }, schools, known),
    ).toBe(true);
    expect(
      candidateBelongsToSelectedSchool(
        { university: "State Tech" },
        schools,
        known,
      ),
    ).toBe(true);
  });
});

describe("filterFacultyDiscoveryCandidates", () => {
  const base = {
    name: "Dr. Sam Lee",
    profileUrl: null,
    profEmail: null,
    matchScore: 4,
    researchArea: "Distributed systems",
    rationale: "Active lab in cloud computing",
    source: "school_program" as const,
  };

  it("keeps candidates tied to a selected school and rewrites labels", () => {
    const out = filterFacultyDiscoveryCandidates(
      [
        {
          ...base,
          schoolId: "sch-1",
          targetSchoolLabel: "Some other label",
        },
      ],
      schools,
    );
    expect(out).toHaveLength(1);
    expect(out[0].schoolId).toBe("sch-1");
    expect(out[0].targetSchoolLabel).toBe("University of Example");
  });

  it("drops wrong-school, inactive, and unnamed candidates", () => {
    const out = filterFacultyDiscoveryCandidates(
      [
        { ...base, schoolId: "sch-1" },
        {
          ...base,
          name: "Dr. Old Timer, Emeritus",
          schoolId: "sch-1",
        },
        {
          ...base,
          name: "Dr. Elsewhere",
          targetSchoolLabel: "MIT",
        },
        {
          ...base,
          name: "   ",
          schoolId: "sch-1",
        },
      ],
      schools,
    );
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("Dr. Sam Lee");
  });
});
