"use client";

import { SessionProvider } from "@/components/providers/session-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
