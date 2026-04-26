import { NextResponse } from "next/server";

/**
 * Tiny JSON response helpers for API route handlers.
 *
 * All return a `NextResponse` with the conventional status code and a JSON
 * body. Use these from inside `withAuth` / `withPlanGate` handlers to keep
 * route logic short and consistent.
 */

/** 200 OK — successful response carrying `data` as JSON. */
export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, { status: 200, ...init });
}

/** 201 Created — resource created, returns the created entity as JSON. */
export function created<T>(data: T): NextResponse {
  return NextResponse.json(data, { status: 201 });
}

/**
 * Generic error response. Pass either a string (wrapped as `{ error }`) or a
 * pre-shaped object (e.g. zod `flatten()` output).
 */
export function bad(error: string | object, status = 400): NextResponse {
  const body = typeof error === "string" ? { error } : error;
  return NextResponse.json(body, { status });
}

/** 401 Unauthorized — caller is not signed in. */
export function unauthorized(error: string = "Unauthorized"): NextResponse {
  return NextResponse.json({ error }, { status: 401 });
}

/** 403 Forbidden — signed in, but lacks permission. */
export function forbidden(error: string = "Forbidden"): NextResponse {
  return NextResponse.json({ error }, { status: 403 });
}

/** 404 Not Found — target resource does not exist (or is not visible). */
export function notFound(error: string = "Not found"): NextResponse {
  return NextResponse.json({ error }, { status: 404 });
}
