import { describe, expect, it } from "vitest";

import { inferTaskFromGeneralMessage } from "@/lib/agents/router-prompt";

describe("inferTaskFromGeneralMessage", () => {
  it("detects SOP intent", () => {
    expect(inferTaskFromGeneralMessage("Help me with my statement of purpose")).toBe(
      "sop",
    );
    expect(inferTaskFromGeneralMessage("review my SOP draft")).toBe("sop");
  });

  it("detects email vs faculty lookup", () => {
    expect(inferTaskFromGeneralMessage("draft a cold email to the PI")).toBe(
      "email",
    );
    expect(
      inferTaskFromGeneralMessage("find professors at MIT in robotics"),
    ).toBeNull();
  });

  it("detects grammar and feedback intents", () => {
    expect(inferTaskFromGeneralMessage("proofread this paragraph")).toBe(
      "grammar",
    );
    expect(inferTaskFromGeneralMessage("tear apart my essay")).toBe("feedback");
  });

  it("returns null for general questions", () => {
    expect(inferTaskFromGeneralMessage("what schools should I apply to?")).toBeNull();
  });
});
