import { prisma } from "@/lib/prisma";
import { isPricingModelRolloutEnabled } from "@/lib/pricing-model-rollout";
const featureLabel = {
    assistant: "AI assistant",
    connectors: "Connectors",
    documents: "Documents",
};
const plusFeatureLabel = {
    priority_generation: "Priority generation",
    advanced_sop_feedback: "Advanced SOP feedback",
    school_specific_suggestions: "School-specific suggestions",
};
export async function getUserPlanTier(userId) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { planTier: true },
    });
    return user?.planTier ?? null;
}
export async function getUserAccessMode(userId) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { accessMode: true },
    });
    return user?.accessMode ?? null;
}
export async function requireWritableAccount(userId) {
    const enabled = await isPricingModelRolloutEnabled();
    if (!enabled)
        return null;
    const mode = await getUserAccessMode(userId);
    if (!mode || mode === "FULL")
        return null;
    return Response.json({
        code: "ACCOUNT_READ_ONLY",
        error: "Your subscription is expired and this account is currently read-only. You can still view data and export.",
    }, { status: 402 });
}
export async function schoolTrackingLimitForUser(userId) {
    const enabled = await isPricingModelRolloutEnabled();
    if (!enabled)
        return 9999;
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { planTier: true },
    });
    if (!user)
        return 3;
    if (user.planTier === "FREE")
        return 3;
    return 25;
}
export async function requireSchoolTrackingCapacity(userId) {
    const limit = await schoolTrackingLimitForUser(userId);
    const current = await prisma.school.count({ where: { userId } });
    if (current < limit)
        return null;
    return Response.json({
        code: "SCHOOL_LIMIT_REACHED",
        error: `School tracking limit reached (${limit}).`,
        limit,
        current,
    }, { status: 402 });
}
export async function requireNonFreeForFeature(userId, feature) {
    const planTier = await getUserPlanTier(userId);
    if (planTier && planTier !== "FREE")
        return null;
    return Response.json({
        code: "PLAN_UPGRADE_REQUIRED",
        feature,
        error: `${featureLabel[feature]} is available on PLUS and PRO plans.`,
    }, { status: 402 });
}
export async function requirePlusForFeature(userId, feature) {
    const planTier = await getUserPlanTier(userId);
    if (planTier === "PLUS")
        return null;
    return Response.json({
        code: "PLUS_PLAN_REQUIRED",
        feature,
        error: `${plusFeatureLabel[feature]} is available on the PLUS plan.`,
    }, { status: 402 });
}
