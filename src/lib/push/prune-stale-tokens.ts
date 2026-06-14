import { prisma } from "@/lib/prisma";

export async function pruneStalePushTokens(tokens: string[]): Promise<number> {
  if (tokens.length === 0) return 0;
  const result = await prisma.pushToken.deleteMany({
    where: { token: { in: tokens } },
  });
  return result.count;
}
