"use client";

import {
  createContext,
  useContext,
  useEffect,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";

import type { AppSession } from "@/auth";
import {
  billingKeys,
  type BillingStatus,
} from "@/features/billing/api";

type ShellContextValue = {
  serverSession: AppSession | null;
  billingStatus: BillingStatus | null;
};

const ShellContext = createContext<ShellContextValue | null>(null);

export function useShell() {
  const ctx = useContext(ShellContext);
  if (!ctx) {
    throw new Error("useShell must be used within ShellProvider");
  }
  return ctx;
}

export function useShellOptional() {
  return useContext(ShellContext);
}

type Props = {
  children: ReactNode;
  serverSession: AppSession;
  billingStatus: BillingStatus | null;
};

/**
 * Seeds TanStack Query with server-fetched billing status so the shell does not
 * block on `/api/billing/status` on first paint in production.
 */
export function ShellProvider({
  children,
  serverSession,
  billingStatus,
}: Props) {
  const qc = useQueryClient();

  useEffect(() => {
    if (billingStatus) {
      qc.setQueryData(billingKeys.status(), billingStatus);
    }
  }, [billingStatus, qc]);

  return (
    <ShellContext.Provider
      value={{ serverSession, billingStatus }}
    >
      {children}
    </ShellContext.Provider>
  );
}
