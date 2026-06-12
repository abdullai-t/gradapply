import { afterEach, describe, expect, it, vi } from "vitest";

import {
  isTrustedMutationOrigin,
  requestPublicOrigin,
} from "@/lib/request-origin";

describe("requestPublicOrigin", () => {
  it("builds origin from forwarded headers", () => {
    const req = new Request("http://internal/", {
      headers: {
        host: "app.example.com",
        "x-forwarded-proto": "https",
        "x-forwarded-host": "app.example.com",
      },
    });
    expect(requestPublicOrigin(req)).toBe("https://app.example.com");
  });

  it("returns null when host is missing", () => {
    const req = new Request("http://internal/");
    expect(requestPublicOrigin(req)).toBeNull();
  });
});

describe("isTrustedMutationOrigin", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("accepts matching Origin header", () => {
    vi.stubEnv("AUTH_URL", "http://localhost:3000");
    const req = new Request("http://localhost:3000/api/auth/session", {
      method: "POST",
      headers: { Origin: "http://localhost:3000" },
    });
    expect(isTrustedMutationOrigin(req)).toBe(true);
  });

  it("rejects forged off-site Origin", () => {
    vi.stubEnv("AUTH_URL", "http://localhost:3000");
    const req = new Request("http://localhost:3000/api/auth/session", {
      method: "POST",
      headers: { Origin: "https://evil.com" },
    });
    expect(isTrustedMutationOrigin(req)).toBe(false);
  });

  it("accepts trusted Referer when Origin is absent", () => {
    vi.stubEnv("AUTH_URL", "http://localhost:3000");
    const req = new Request("http://localhost:3000/api/foo", {
      method: "POST",
      headers: { Referer: "http://localhost:3000/login" },
    });
    expect(isTrustedMutationOrigin(req)).toBe(true);
  });

  it("allows sec-fetch-site same-origin without Origin", () => {
    vi.stubEnv("AUTH_URL", "http://localhost:3000");
    const req = new Request("http://localhost:3000/api/foo", {
      method: "POST",
      headers: { "sec-fetch-site": "same-origin" },
    });
    expect(isTrustedMutationOrigin(req)).toBe(true);
  });

  it("rejects sec-fetch-site none in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_URL", "http://localhost:3000");
    const req = new Request("http://localhost:3000/api/foo", {
      method: "POST",
      headers: { "sec-fetch-site": "none" },
    });
    expect(isTrustedMutationOrigin(req)).toBe(false);
  });

  it("allows sec-fetch-site none in non-production", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("AUTH_URL", "http://localhost:3000");
    const req = new Request("http://localhost:3000/api/foo", {
      method: "POST",
      headers: { "sec-fetch-site": "none" },
    });
    expect(isTrustedMutationOrigin(req)).toBe(true);
  });
});
