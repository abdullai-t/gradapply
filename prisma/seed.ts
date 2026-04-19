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

  console.log("\nSeed user (email + password):\n");
  console.log(`  Email:    ${TEST_EMAIL}`);
  console.log(`  Password: ${TEST_PASSWORD}\n`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
