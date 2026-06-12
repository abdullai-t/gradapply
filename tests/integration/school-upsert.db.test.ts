import { Prisma } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  disconnectTestDatabase,
  getTestPrisma,
  isDbTestEnabled,
  resetTestDatabase,
  seedMinimalUsers,
} from "../helpers/prisma-test-db";

const describeDb = isDbTestEnabled() ? describe : describe.skip;

describeDb("School unique (userId, name, program)", () => {
  let userId: string;

  beforeEach(async () => {
    await resetTestDatabase();
    const users = await seedMinimalUsers();
    userId = users.plusUserId;
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  it("rejects duplicate school rows for same user", async () => {
    const prisma = getTestPrisma();
    await prisma.school.create({
      data: {
        userId,
        name: "MIT",
        program: "CS PhD",
        degree: "PhD",
      },
    });
    await expect(
      prisma.school.create({
        data: {
          userId,
          name: "MIT",
          program: "CS PhD",
          degree: "PhD",
        },
      }),
    ).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
  });

  it("allows same name/program for different users", async () => {
    const prisma = getTestPrisma();
    const other = await prisma.user.create({
      data: {
        email: "other@test.local",
        planTier: "FREE",
      },
    });
    await prisma.school.create({
      data: {
        userId,
        name: "MIT",
        program: "CS PhD",
        degree: "PhD",
      },
    });
    await expect(
      prisma.school.create({
        data: {
          userId: other.id,
          name: "MIT",
          program: "CS PhD",
          degree: "PhD",
        },
      }),
    ).resolves.toBeDefined();
  });
});
