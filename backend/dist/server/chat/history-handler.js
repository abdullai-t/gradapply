// @ts-nocheck
import { getUserPlanTier } from "@/lib/plan-gates";
import { prisma } from "@/lib/prisma";
import { ok } from "../_responses";
import { withAuth } from "../_with-auth";
import { buildSchoolScopeWhere, chatSupportsSchoolScope } from "./shared";
export const history = withAuth(async (req, { userId }) => {
    const url = new URL(req.url);
    const mode = url.searchParams.get("mode");
    const schoolId = url.searchParams.get("schoolId");
    const supportsSchoolScope = await chatSupportsSchoolScope();
    // Run plan check + history query in parallel (was sequential, ~150ms savings)
    const [planTier, messages] = await Promise.all([
        getUserPlanTier(userId),
        prisma.chatMessage.findMany({
            where: {
                userId,
                ...(mode ? { mode } : {}),
                // When schoolId is supplied (SOP studio), scope strictly to that school.
                // When omitted, return only non-school-scoped messages so general chats
                // don't include per-school SOP exchanges.
                ...buildSchoolScopeWhere(supportsSchoolScope, schoolId),
            },
            // Only the fields the client uses — skips the implicit userId column
            // and avoids serializing fields the UI never reads.
            select: {
                id: true,
                role: true,
                content: true,
                mode: true,
                ...(supportsSchoolScope ? { schoolId: true } : {}),
            },
            orderBy: { createdAt: "asc" },
            take: 200,
        }),
    ]);
    if (!planTier || planTier === "FREE") {
        return Response.json({
            code: "PLAN_UPGRADE_REQUIRED",
            feature: "assistant",
            error: "AI assistant is available on PLUS and PRO plans.",
        }, { status: 402 });
    }
    // Allow short-term browser caching — chat history is per-user and changes
    // infrequently between page navigations. React Query's 30s staleTime pairs
    // with this so a back-and-forth navigation never re-hits the database.
    return ok(messages, {
        headers: { "Cache-Control": "private, max-age=10, must-revalidate" },
    });
});
