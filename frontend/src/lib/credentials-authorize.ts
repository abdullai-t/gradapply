import { verifyPassword } from "@/lib/password";

type AuthorizeInput = {
  email: string;
  password: string;
};

/** Matches the Prisma-shaped `user` delegate from `@gradapply/db`. */
type UserDelegate = {
  findUnique: (args: {
    where: { email: string };
  }) => Promise<{
    id: string;
    passwordHash?: string | null;
    emailVerified?: Date | null;
    email?: string | null;
    name?: string | null;
    image?: string | null;
  } | null>;
};

export async function credentialsAuthorize(
  prisma: { user: UserDelegate },
  { email, password }: AuthorizeInput,
) {
  if (!email || !password) return null;

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
  });

  if (!user?.passwordHash) return null;
  if (!user.emailVerified) return null;

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return null;

  return {
    id: user.id,
    email: user.email ?? undefined,
    name: user.name ?? undefined,
    image: user.image ?? undefined,
  };
}
