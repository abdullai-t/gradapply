import { getBillingAdminConfig } from "@/lib/billing-admin-config";
import { prisma } from "@/lib/prisma";

export async function grantCreditsPackToUser(
  userId: string,
  amount?: number,
): Promise<void> {
  const cfg = await getBillingAdminConfig();
  const n =
    typeof amount === "number" && Number.isFinite(amount) && amount > 0
      ? Math.floor(amount)
      : cfg.creditsPackSize;
  await prisma.user.update({
    where: { id: userId },
    data: { aiCreditsBalance: { increment: n } },
  });
}
