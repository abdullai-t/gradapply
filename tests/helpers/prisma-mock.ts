import { vi } from "vitest";

type PrismaMock = {
  user: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
  paystackEventLog: { create: ReturnType<typeof vi.fn> };
  billingPayment: { create: ReturnType<typeof vi.fn> };
  chatMessage: {
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  school: {
    findUnique: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
  $queryRaw: ReturnType<typeof vi.fn>;
};

export function buildPrismaMock(): PrismaMock {
  const mock: PrismaMock = {
    user: {
      findUnique: vi.fn(),
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
    },
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
  };
  mock.$transaction.mockImplementation(async (fn: (tx: PrismaMock) => unknown) =>
    fn(mock),
  );
  return mock;
}
