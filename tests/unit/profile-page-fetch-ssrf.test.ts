import { describe, expect, it } from "vitest";

import { assertHttpUrlFetchAllowedSync } from "@/lib/profile-page-fetch";

describe("assertHttpUrlFetchAllowedSync", () => {
  it("allows public https URLs", () => {
    expect(() =>
      assertHttpUrlFetchAllowedSync(new URL("https://stanford.edu/~faculty")),
    ).not.toThrow();
  });

  it("blocks non-http schemes", () => {
    expect(() =>
      assertHttpUrlFetchAllowedSync(new URL("file:///etc/passwd")),
    ).toThrow(/http/i);
  });

  it("blocks loopback and metadata hosts", () => {
    expect(() =>
      assertHttpUrlFetchAllowedSync(new URL("http://127.0.0.1/admin")),
    ).toThrow();
    expect(() =>
      assertHttpUrlFetchAllowedSync(
        new URL("http://169.254.169.254/latest/meta-data"),
      ),
    ).toThrow();
    expect(() =>
      assertHttpUrlFetchAllowedSync(new URL("http://localhost/profile")),
    ).toThrow();
  });

  it("blocks decimal IP literals", () => {
    // 127.0.0.1 as decimal
    expect(() =>
      assertHttpUrlFetchAllowedSync(new URL("http://2130706433/")),
    ).toThrow();
  });
});
