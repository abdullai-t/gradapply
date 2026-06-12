import { describe, expect, it } from "vitest";

import {
  buildSchoolScopeWhere,
  reverseChronologicalToHistory,
} from "@/server/chat/shared";

describe("chat shared helpers", () => {
  it("reverseChronologicalToHistory flips order", () => {
    const history = reverseChronologicalToHistory([
      { role: "assistant", content: "b" },
      { role: "user", content: "a" },
    ]);
    expect(history).toEqual([
      { role: "user", content: "a" },
      { role: "assistant", content: "b" },
    ]);
  });

  it("buildSchoolScopeWhere scopes or ignores", () => {
    expect(buildSchoolScopeWhere(false, "school-1")).toEqual({});
    expect(buildSchoolScopeWhere(true, "school-1")).toEqual({
      schoolId: "school-1",
    });
    expect(buildSchoolScopeWhere(true, null)).toEqual({ schoolId: null });
  });
});
