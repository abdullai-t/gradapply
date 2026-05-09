// @ts-nocheck
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
export async function credentialsAuthorize(_unusedDb, { email, password }) {
    if (!email || !password)
        return null;
    const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase().trim() },
    });
    if (!user?.passwordHash)
        return null;
    if (!user.emailVerified)
        return null;
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok)
        return null;
    return {
        id: user.id,
        email: user.email ?? undefined,
        name: user.name ?? undefined,
        image: user.image ?? undefined,
    };
}
