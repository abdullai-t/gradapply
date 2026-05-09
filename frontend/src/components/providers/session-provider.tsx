"use client";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";

export function SessionProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextAuthSessionProvider
      // Disable automatic refetching on window focus to prevent excessive
      // session checks during development (HMR) and in production.
      // Components can manually refetch when needed via useSession({ required: true })
      refetchOnWindowFocus={false}
      // Keep refetchInterval at 0 (no polling) - default but explicit for clarity
      refetchInterval={0}
    >
      {children}
    </NextAuthSessionProvider>
  );
}
