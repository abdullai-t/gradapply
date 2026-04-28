"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import type { ReactNode } from "react";

import { getQueryClient } from "@/lib/query-client";

/**
 * App-wide TanStack Query provider.
 *
 * Uses the SSR-safe singleton from `@/lib/query-client` so the same client is
 * reused across renders in the browser, and a fresh client is created per
 * request on the server.
 *
 * Devtools are only mounted in development to keep them out of the production
 * bundle.
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const client = getQueryClient();
  return (
    <QueryClientProvider client={client}>
      {children}
      {process.env.NODE_ENV === "development" ? (
        <ReactQueryDevtools initialIsOpen={false} />
      ) : null}
    </QueryClientProvider>
  );
}
