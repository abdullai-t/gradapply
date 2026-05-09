// @ts-nocheck
import { requireNonFreeForFeature, requireWritableAccount, } from "@/lib/plan-gates";
import { withAuth } from "./_with-auth";
/**
 * Composes `withAuth` with the FREE-plan gate for a given feature.
 *
 * The wrapped handler runs only when:
 *   1. A session exists (delegated to `withAuth`), and
 *   2. The user's plan is non-FREE for `feature` (per
 *      `requireNonFreeForFeature`).
 *
 * If either check fails, the appropriate short-circuit response is returned
 * (`401 Unauthorized` from `withAuth`, or the `402 PLAN_UPGRADE_REQUIRED`
 * payload from `requireNonFreeForFeature`).
 *
 * Use this wrapper for routes that today contain the boilerplate:
 *
 * ```ts
 * const locked = await requireNonFreeForFeature(session.user.id, "documents");
 * if (locked) return locked;
 * ```
 */
export function withPlanGate(feature, handler) {
    return withAuth(async (req, ctx) => {
        if (req.method !== "GET") {
            const readOnly = await requireWritableAccount(ctx.userId);
            if (readOnly)
                return readOnly;
        }
        const locked = await requireNonFreeForFeature(ctx.userId, feature);
        if (locked)
            return locked;
        return handler(req, ctx);
    });
}
