import { describe, expect, it } from "vitest";

import { sanitizeRichHtml } from "@/lib/sanitize-html";

describe("sanitizeRichHtml", () => {
  it("strips script tags and event handlers", () => {
    const dirty =
      '<p onclick="alert(1)">Hi</p><script>alert("xss")</script><img src=x onerror=alert(1)>';
    const clean = sanitizeRichHtml(dirty);
    expect(clean).not.toContain("<script");
    expect(clean).not.toContain("onclick");
    expect(clean).not.toContain("onerror");
    expect(clean).toContain("Hi");
  });

  it("keeps allowed formatting tags", () => {
    const html = "<p><strong>Bold</strong> and <em>italic</em></p>";
    expect(sanitizeRichHtml(html)).toContain("<strong>Bold</strong>");
  });
});
