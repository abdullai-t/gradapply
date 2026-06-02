import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const TEST_EMAIL = "test@gradapply.local";
const TEST_PASSWORD = "password123";

async function main() {
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 12);

  await prisma.user.upsert({
    where: { email: TEST_EMAIL },
    update: {
      passwordHash,
      name: "Test User",
    },
    create: {
      email: TEST_EMAIL,
      passwordHash,
      name: "Test User",
      emailVerified: new Date(),
    },
  });

  await prisma.featureFlag.upsert({
    where: { key: "collaboration" },
    update: { enabled: true },
    create: {
      key: "collaboration",
      name: "Scholar collaboration",
      description:
        "Async review sessions and live co-editing between GradApply scholars.",
      enabled: true,
    },
  });

  console.log("\nSeed DB user (for local data only — sign in via Firebase at /login):\n");
  console.log(`  Email:    ${TEST_EMAIL}`);
  console.log(`  (legacy password hash kept for migrations; auth is Firebase)\n`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
