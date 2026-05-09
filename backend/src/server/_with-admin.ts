// @ts-nocheck
import { type ElevatedRole, requireElevatedUser } from "@/lib/admin-auth";

import { forbidden } from "./_responses";
import { withAuth } from "./_with-auth";

/**
 * A route handler that runs after `withAdmin` has confirmed an elevated
 * (ADMIN or SUPERADMIN) session.
 *
 * Receives the resolved `userId` and the actor's elevated `role`, plus
 * the Next.js dynamic-route `params` object.
 */
export type AdminHandler<TParams = Record<string, string>> = (
  req: Request,
  ctx: { userId: string; role: ElevatedRole; params: TParams },
) => Promise<Response> | Response;

/**
 * Wraps an admin route handler so the boilerplate
 *
 * ```ts
 * const actor = await requireElevatedUser();
 * if (!actor)
 *   return NextResponse.json({ error: "Forbidden" }, { status: 403 });
 * ```
 *
 * lives in exactly one place.
 *
 * Composes on top of `withAuth` so unauthenticated callers receive a 401
 * (rather than the 403 that authenticated-but-non-elevated users see).
 * The wrapped handler is invoked only after both checks pass and receives
 * the actor's `userId` and elevated `role` directly.
 */
export function withAdmin<TParams = Record<string, string>>(
  handler: AdminHandler<TParams>,
): (req: Request, routeCtx: { params: TParams }) => Promise<Response> {
  return withAuth<TParams>(async (req, ctx) => {
    const actor = await requireElevatedUser(req);
    if (!actor) return forbidden();
    return handler(req, { userId: actor.userId, role: actor.role, params: ctx.params });
  });
}
