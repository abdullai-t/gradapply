import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/push/register/route";
import { DELETE } from "@/app/api/push/unregister/route";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    pushToken: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

describe("push token routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("POST /api/push/register returns 401 without session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await POST(
      new Request("http://localhost:3000/api/push/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost:3000",
        },
        body: JSON.stringify({ token: "a".repeat(40), platform: "web" }),
      }),
      { params: Promise.resolve({}) },
    );
    expect(res.status).toBe(401);
  });

  it("POST /api/push/register upserts token for authed user", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-1" },
    } as never);
    vi.mocked(prisma.pushToken.upsert).mockResolvedValue({
      id: "pt-1",
    } as never);

    const token = "fcm-token-" + "x".repeat(32);
    const res = await POST(
      new Request("http://localhost:3000/api/push/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost:3000",
          "User-Agent": "vitest",
        },
        body: JSON.stringify({ token, platform: "web" }),
      }),
      { params: Promise.resolve({}) },
    );

    expect(res.status).toBe(200);
    expect(prisma.pushToken.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { token },
        create: expect.objectContaining({ userId: "user-1", token }),
      }),
    );
  });

  it("DELETE /api/push/unregister removes tokens for authed user", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-1" },
    } as never);
    vi.mocked(prisma.pushToken.deleteMany).mockResolvedValue({ count: 1 });

    const res = await DELETE(
      new Request("http://localhost:3000/api/push/unregister", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost:3000",
        },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({}) },
    );

    expect(res.status).toBe(200);
    expect(prisma.pushToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
    });
  });
});
