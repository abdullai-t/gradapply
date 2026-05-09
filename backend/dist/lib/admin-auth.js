// @ts-nocheck
import { resolveUserId } from "@/lib/auth-session";
import { User } from "@/models";
export async function getCurrentUserRole(userId) {
    const user = (await User.findById(userId).select({ role: 1 }).lean());
    return user?.role ?? null;
}
export async function requireElevatedUser(req) {
    const userId = await resolveUserId(req);
    if (!userId)
        return null;
    let role = await getCurrentUserRole(userId);
    if (role === "USER") {
        const allowList = (process.env.SUPERADMIN_EMAILS ?? "")
            .split(",")
            .map((v) => v.trim().toLowerCase())
            .filter(Boolean);
        if (allowList.length > 0) {
            const user = (await User.findById(userId)
                .select({ email: 1, emailVerified: 1 })
                .lean());
            const email = user?.email?.trim().toLowerCase();
            const isVerified = Boolean(user?.emailVerified);
            if (email && isVerified && allowList.includes(email)) {
                const superadminCount = await User.countDocuments({
                    role: "SUPERADMIN",
                });
                if (superadminCount > 0) {
                    return null;
                }
                await User.findByIdAndUpdate(userId, { role: "SUPERADMIN" });
                role = "SUPERADMIN";
            }
        }
    }
    if (role !== "ADMIN" && role !== "SUPERADMIN")
        return null;
    return { userId, role };
}
export function canManageRole(actor) {
    return actor === "ADMIN" || actor === "SUPERADMIN";
}
export function canAssignRole(actor, targetRole) {
    if (actor === "SUPERADMIN")
        return true;
    return targetRole !== "SUPERADMIN";
}
export function canManageTargetUser(actor, targetRole) {
    if (actor === "SUPERADMIN")
        return true;
    return targetRole !== "SUPERADMIN";
}
