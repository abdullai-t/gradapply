// @ts-nocheck
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";

type AuthorizeInput = {
  email: string;
  password: string;
};

export async function credentialsAuthorize(
  _unusedDb: unknown,
  { email, password }: AuthorizeInput,
) {
  if (!email || !password) return null;

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
  });

  if (!user?.passwordHash) return null;
  if (!user.emailVerified) return null;

  const ok = await verifyPassword(password, user.passwordHash as string);
  if (!ok) return null;

  return {
    id: user.id as string,
    email: (user.email as string | undefined) ?? undefined,
    name: (user.name as string | undefined) ?? undefined,
    image: (user.image as string | undefined) ?? undefined,
  };
}
