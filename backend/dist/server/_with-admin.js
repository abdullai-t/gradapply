// @ts-nocheck
import { requireElevatedUser } from "@/lib/admin-auth";
import { forbidden } from "./_responses";
import { withAuth } from "./_with-auth";
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
export function withAdmin(handler) {
    return withAuth(async (req, ctx) => {
        const actor = await requireElevatedUser(req);
        if (!actor)
            return forbidden();
        return handler(req, { userId: actor.userId, role: actor.role, params: ctx.params });
    });
}
