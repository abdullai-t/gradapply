import posthog from "posthog-js";

/**
 * Client-side PostHog is off in development unless NEXT_PUBLIC_POSTHOG_DEV=true.
 * Set NEXT_PUBLIC_POSTHOG_DISABLED=true to force off in any environment.
 */
export function shouldInitPostHogClient(): boolean {
  if (process.env.NEXT_PUBLIC_POSTHOG_DISABLED === "true") return false;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim();
  if (!key) return false;
  if (process.env.NODE_ENV === "development") {
    return process.env.NEXT_PUBLIC_POSTHOG_DEV === "true";
  }
  return true;
}

function resolveApiHost(): string {
  const explicit = process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim();
  if (explicit) return explicit;
  // OpenNext on Cloudflare does not apply Next.js rewrites the same way as Node.
  if (process.env.NEXT_PUBLIC_POSTHOG_USE_PROXY === "false") {
    return "https://us.i.posthog.com";
  }
  if (process.env.CF_BUILD === "1") {
    return "https://us.i.posthog.com";
  }
  return "/ingest";
}

let initialized = false;

/** Call once from instrumentation-client.ts */
export function initPostHogClient(): void {
  if (initialized || !shouldInitPostHogClient()) return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY!.trim();

  posthog.init(key, {
    api_host: resolveApiHost(),
    ui_host: "https://us.posthog.com",
    person_profiles: "identified_only",
    capture_pageview: true,
    capture_exceptions: process.env.NODE_ENV === "production",
    debug: process.env.NEXT_PUBLIC_POSTHOG_DEBUG === "true",
    disable_session_recording:
      process.env.NEXT_PUBLIC_POSTHOG_SESSION_RECORDING !== "true",
  });

  initialized = true;
}

export function isPostHogClientReady(): boolean {
  if (!initialized) return false;
  const loaded = (posthog as typeof posthog & { __loaded?: boolean }).__loaded;
  return loaded === true;
}

/** Safe client capture — no-op when PostHog is disabled or not loaded. */
export function capturePostHogEvent(
  event: string,
  properties?: Record<string, string | number | boolean | null | undefined>,
): void {
  if (!shouldInitPostHogClient() || !isPostHogClientReady()) return;
  try {
    posthog.capture(event, properties);
  } catch {
    // Analytics must never break product flows.
  }
}
