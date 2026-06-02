"use client";

import { FirebaseAuthProvider } from "@/components/providers/firebase-auth-provider";

export function SessionProvider({ children }: { children: React.ReactNode }) {
  return <FirebaseAuthProvider>{children}</FirebaseAuthProvider>;
}
