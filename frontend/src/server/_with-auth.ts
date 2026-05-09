import { resolveUserId } from "@/lib/auth-session";
import { isTrustedMutationOrigin } from "@/lib/request-origin";

import { forbidden, unauthorized } from "./_responses";

/**
 * A route handler that runs after `withAuth` has confirmed a session.
 *
 * @param req       The incoming `Request`.
 * @param ctx       Wrapper-supplied context: the resolved `userId` plus the
 *                  Next.js dynamic-route `params` object (empty for static
 *                  routes).
 */
export type AuthedHandler<TParams = Record<string, string>> = (
  req: Request,
  ctx: { userId: string; params: TParams },
) => Promise<Response> | Response;

/**
 * Wraps an authed route handler so the boilerplate
 *
 * ```ts
 * const userId = await resolveUserId(req);
 * if (!userId)
 *   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
 * ```
 *
 * lives in exactly one place. The wrapped handler is invoked only after a
 * session is confirmed, and receives the resolved `userId` directly so it
 * never has to re-parse the session.
 *
 * Inner handlers are free to use the `ok()`, `bad()`, `notFound()`, etc.
 * helpers from `./_responses` or to return a `NextResponse` directly — both
 * are valid `Response` instances.
 *
 * Compatible with the Next.js 14 App Router signature
 * `(req, { params }) => Promise<Response>` for dynamic routes; for static
 * routes the `routeCtx` argument is supplied (as `{ params: {} }`) by Next.js
 * itself, so this wrapper handles both.
 */
export function withAuth<TParams = Record<string, string>>(
  handler: AuthedHandler<TParams>,
): (req: Request, routeCtx: { params: TParams }) => Promise<Response> {
  return async (req, routeCtx) => {
    const userId = await resolveUserId(req);
    if (!userId) return unauthorized();
    const method = req.method.toUpperCase();
    if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
      if (!isTrustedMutationOrigin(req)) return forbidden("Untrusted origin");
    }

    const params = (routeCtx?.params ?? ({} as TParams)) as TParams;
    return handler(req, { userId, params });
  };
}
