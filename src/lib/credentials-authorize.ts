import type { PrismaClient } from "@prisma/client";
import { verifyPassword } from "@/lib/password";

type AuthorizeInput = {
  email: string;
  password: string;
};

export async function credentialsAuthorize(
  prisma: PrismaClient,
  { email, password }: AuthorizeInput,
) {
  if (!email || !password) return null;

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
  });

  if (!user?.passwordHash) return null;

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return null;

  return {
    id: user.id,
    email: user.email ?? undefined,
    name: user.name ?? undefined,
    image: user.image ?? undefined,
  };
}
