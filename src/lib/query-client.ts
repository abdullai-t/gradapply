import { QueryClient } from "@tanstack/react-query";

/**
 * Factory that produces a fresh QueryClient with the project's defaults.
 *
 * - `staleTime: 30s` keeps client navigation snappy without immediately refetching
 *   on every mount.
 * - `refetchOnWindowFocus: true` keeps long-lived tabs in sync.
 * - `retry: 1` for queries / `retry: 0` for mutations matches the v3 PRD
 *   (a single retry guards against transient network blips, but mutations should
 *   surface failures so the UI can react explicitly).
 */
export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: true,
        retry: 1,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

/**
 * SSR-safe singleton accessor.
 *
 * On the **server** every request must get a fresh client — sharing one across
 * requests would leak per-user data and produce hydration mismatches. We detect
 * the server by `typeof window === "undefined"` and always return a new client
 * there.
 *
 * In the **browser** we cache the client on a module-level variable so it
 * survives Fast Refresh / HMR and is reused across renders. Without this,
 * every re-render of the provider tree would discard the cache.
 *
 * This is the standard TanStack Query v5 SSR pattern; see
 * https://tanstack.com/query/v5/docs/framework/react/guides/advanced-ssr
 */
let browserQueryClient: QueryClient | undefined;

export function getQueryClient(): QueryClient {
  if (typeof window === "undefined") {
    // Server: always make a new client.
    return makeQueryClient();
  }
  // Browser: reuse the cached client across renders / Fast Refresh.
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }
  return browserQueryClient;
}
