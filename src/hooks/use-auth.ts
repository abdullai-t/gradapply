"use client";

import { useContext } from "react";

import { AuthContext } from "@/components/providers/firebase-auth-provider";

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within FirebaseAuthProvider");
  }
  return ctx;
}

/** Drop-in shape for components that used `useSession` from next-auth. */
export function useSession() {
  const { session, status } = useAuth();
  return {
    data: session,
    status,
  };
}
