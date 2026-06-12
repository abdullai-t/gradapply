import { afterEach, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => {
  const mock = {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    paystackEventLog: { create: vi.fn() },
    billingPayment: { create: vi.fn() },
    chatMessage: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    school: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
  };
  mock.$transaction.mockImplementation(
    async (fn: (tx: typeof mock) => unknown) => fn(mock),
  );
  return { prismaMock: mock };
});

export { prismaMock };

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

if (!process.env.NODE_ENV) {
  vi.stubEnv("NODE_ENV", "test");
}
if (!process.env.AUTH_URL) {
  vi.stubEnv("AUTH_URL", "http://localhost:3000");
}
if (!process.env.NEXT_PUBLIC_APP_URL) {
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
}

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});
