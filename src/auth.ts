import { isFirebaseConfigured } from "@/lib/firebase/config";
import { getAppSession, type AppSession } from "@/lib/firebase/server-session";

export type { AppSession, AppSessionUser } from "@/lib/firebase/server-session";

/**
 * Server session from Firebase ID token cookie.
 * Replaces NextAuth `auth()` — import from `@/auth` in server code.
 */
export async function auth(): Promise<AppSession | null> {
  return getAppSession();
}

/** Login UI / health checks. */
export function getAuthSetupStatus() {
  const hasFirebase = isFirebaseConfigured();
  return {
    hasGoogle: hasFirebase,
    hasEmail: hasFirebase,
    hasFirebase,
    providerCount: hasFirebase ? 2 : 0,
  };
}

export type LoginSetup = ReturnType<typeof getAuthSetupStatus>;
