// @ts-nocheck
/**
 * Tiny JSON response helpers for API route handlers.
 *
 * All return a `NextResponse` with the conventional status code and a JSON
 * body. Use these from inside `withAuth` / `withPlanGate` handlers to keep
 * route logic short and consistent.
 */
/** 200 OK — successful response carrying `data` as JSON. */
export function ok(data, init) {
    return Response.json(data, { status: 200, ...init });
}
/** 201 Created — resource created, returns the created entity as JSON. */
export function created(data) {
    return Response.json(data, { status: 201 });
}
/**
 * Generic error response. Pass either a string (wrapped as `{ error }`) or a
 * pre-shaped object (e.g. zod `flatten()` output).
 */
export function bad(error, status = 400) {
    const body = typeof error === "string" ? { error } : error;
    return Response.json(body, { status });
}
/** 401 Unauthorized — caller is not signed in. */
export function unauthorized(error = "Unauthorized") {
    return Response.json({ error }, { status: 401 });
}
/** 403 Forbidden — signed in, but lacks permission. */
export function forbidden(error = "Forbidden") {
    return Response.json({ error }, { status: 403 });
}
/** 404 Not Found — target resource does not exist (or is not visible). */
export function notFound(error = "Not found") {
    return Response.json({ error }, { status: 404 });
}
