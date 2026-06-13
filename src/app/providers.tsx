"use client";

import { ConfirmProvider } from "@/components/confirm-dialog";
import { SessionProvider } from "@/components/providers/session-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ConfirmProvider>{children}</ConfirmProvider>
    </SessionProvider>
  );
}
