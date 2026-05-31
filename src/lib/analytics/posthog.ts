/**
 * Optional PostHog product analytics (Phase 3).
 *
 * @see DEPLOY.md — Observability / PostHog
 */

import { shouldInitPostHogClient } from "@/lib/analytics/posthog-client";

/** Key present in env (admin link-out). */
export function isPostHogConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim());
}

/** Client SDK should actually run (prod, or dev with POSTHOG_DEV). */
export function isPostHogClientEnabled(): boolean {
  return shouldInitPostHogClient();
}

export function getPostHogHost(): string {
  return (
    process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() ||
    "https://us.i.posthog.com"
  );
}

export function getPostHogAppUrl(): string | null {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim();
  if (!key) return null;
  const project = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_ID?.trim();
  if (project) {
    return `https://us.posthog.com/project/${project}`;
  }
  return "https://us.posthog.com";
}

export { capturePostHogEvent as trackFeature } from "@/lib/analytics/posthog-client";
