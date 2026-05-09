import { prisma } from "../src/lib/prisma";

async function main() {
  const now = new Date();
  const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

  const result = await prisma.user.updateMany({
    where: {},
    data: {
      aiUsageMonth: month,
      freeEmailGenUsed: 0,
      freeSopPreviewUsed: 0,
    },
  });

  console.info("[pricing-rollout] backfill complete", {
    updatedUsers: result.count,
    month,
  });
}

main()
  .catch((error) => {
    console.error("[pricing-rollout] backfill failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
