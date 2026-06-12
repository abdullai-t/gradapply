import { describe, expect, it } from "vitest";

import {
  buildSchoolScopeWhere,
  reverseChronologicalToHistory,
} from "@/server/chat/shared";

describe("chat shared helpers", () => {
  it("builds school scope filters", () => {
    expect(buildSchoolScopeWhere(false, "school-1")).toEqual({});
    expect(buildSchoolScopeWhere(true, "school-1")).toEqual({
      schoolId: "school-1",
    });
    expect(buildSchoolScopeWhere(true, null)).toEqual({ schoolId: null });
  });

  it("reverses message order for orchestrator history", () => {
    expect(
      reverseChronologicalToHistory([
        { role: "assistant", content: "b" },
        { role: "user", content: "a" },
      ]),
    ).toEqual([
      { role: "user", content: "a" },
      { role: "assistant", content: "b" },
    ]);
  });
});
