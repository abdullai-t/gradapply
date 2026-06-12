import { describe, expect, it } from "vitest";

import {
  bad,
  created,
  forbidden,
  notFound,
  ok,
  unauthorized,
} from "@/server/_responses";

describe("server response helpers", () => {
  it("ok and created return JSON payloads", async () => {
    const success = ok({ id: "1" });
    expect(success.status).toBe(200);
    await expect(success.json()).resolves.toEqual({ id: "1" });

    const made = created({ id: "2" });
    expect(made.status).toBe(201);
    await expect(made.json()).resolves.toEqual({ id: "2" });
  });

  it("bad accepts string or object bodies", async () => {
    const str = bad("nope");
    expect(str.status).toBe(400);
    await expect(str.json()).resolves.toEqual({ error: "nope" });

    const obj = bad({ fieldErrors: { name: ["required"] } }, 422);
    expect(obj.status).toBe(422);
    await expect(obj.json()).resolves.toEqual({
      fieldErrors: { name: ["required"] },
    });
  });

  it("auth helpers use conventional status codes", async () => {
    expect(unauthorized().status).toBe(401);
    expect(forbidden().status).toBe(403);
    expect(notFound().status).toBe(404);
  });
});
