import { log } from "@/lib/logger";

export type CloudflareWorkerMetrics = {
  configured: boolean;
  dashboardUrl: string;
  rangeDays: number;
  requests: number | null;
  errors: number | null;
  subrequests: number | null;
  errorRatePct: number | null;
  cpuTimeP50Ms: number | null;
  cpuTimeP99Ms: number | null;
  durationP50Ms: number | null;
  durationP99Ms: number | null;
  errorMessage?: string;
};

const GRAPHQL_URL = "https://api.cloudflare.com/client/v4/graphql";

function workerDashboardUrl(accountId: string, workerName: string): string {
  return `https://dash.cloudflare.com/${accountId}/workers/services/view/${workerName}/production/observability`;
}

function accountId(): string | null {
  return process.env.CLOUDFLARE_ACCOUNT_ID?.trim() || null;
}

function apiToken(): string | null {
  return process.env.CLOUDFLARE_API_TOKEN?.trim() || null;
}

function workerName(): string {
  return process.env.CLOUDFLARE_WORKER_NAME?.trim() || "mygradapply";
}

/** Turn Cloudflare GraphQL auth errors into actionable admin copy. */
export function formatCloudflareAnalyticsError(message: string): string {
  const lower = message.toLowerCase();
  if (
    lower.includes("authorization") ||
    lower.includes("authz") ||
    lower.includes("access denied") ||
    lower.includes("not authorized")
  ) {
    return (
      "API token rejected. Create a custom token with Account → Account Analytics → Read, " +
      "scoped to your account (not a Workers-deploy-only token). " +
      "https://dash.cloudflare.com/profile/api-tokens"
    );
  }
  return message;
}

type GraphQlResponse = {
  data?: {
    viewer?: {
      accounts?: Array<{
        workersInvocationsAdaptive?: Array<{
          sum?: {
            requests?: number;
            errors?: number;
            subrequests?: number;
          };
          quantiles?: {
            cpuTimeP50?: number;
            cpuTimeP99?: number;
            durationP50?: number;
            durationP99?: number;
          };
        }>;
      }>;
    };
  };
  errors?: Array<{ message?: string }>;
};

/**
 * Fetches aggregated Worker metrics from Cloudflare GraphQL Analytics API.
 * Requires CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN (Analytics Read).
 */
export async function getCloudflareWorkerMetrics(
  rangeDays: number,
): Promise<CloudflareWorkerMetrics> {
  const acct = accountId();
  const token = apiToken();
  const script = workerName();
  const dashboardUrl = acct
    ? workerDashboardUrl(acct, script)
    : "https://dash.cloudflare.com/?to=/:account/workers";

  if (!acct || !token) {
    return {
      configured: false,
      dashboardUrl,
      rangeDays,
      requests: null,
      errors: null,
      subrequests: null,
      errorRatePct: null,
      cpuTimeP50Ms: null,
      cpuTimeP99Ms: null,
      durationP50Ms: null,
      durationP99Ms: null,
    };
  }

  const until = new Date();
  const since = new Date(until.getTime() - rangeDays * 24 * 60 * 60 * 1000);

  const query = `
    query WorkerMetrics($accountTag: String!, $scriptName: String!, $since: DateTime!, $until: DateTime!) {
      viewer {
        accounts(filter: { accountTag: $accountTag }) {
          workersInvocationsAdaptive(
            filter: {
              datetime_geq: $since
              datetime_leq: $until
              scriptName: $scriptName
            }
            limit: 1
          ) {
            sum {
              requests
              errors
              subrequests
            }
            quantiles {
              cpuTimeP50
              cpuTimeP99
              durationP50
              durationP99
            }
          }
        }
      }
    }
  `;

  try {
    const res = await fetch(GRAPHQL_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        variables: {
          accountTag: acct,
          scriptName: script,
          since: since.toISOString(),
          until: until.toISOString(),
        },
      }),
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      log.warn("cloudflare.analytics.http_error", {
        status: res.status,
        body: text.slice(0, 200),
      });
      return {
        configured: true,
        dashboardUrl,
        rangeDays,
        requests: null,
        errors: null,
        subrequests: null,
        errorRatePct: null,
        cpuTimeP50Ms: null,
        cpuTimeP99Ms: null,
        durationP50Ms: null,
        durationP99Ms: null,
        errorMessage: `Cloudflare API returned ${res.status}`,
      };
    }

    const json = (await res.json()) as GraphQlResponse;
    if (json.errors?.length) {
      const raw = json.errors[0]?.message ?? "GraphQL error";
      return {
        configured: true,
        dashboardUrl,
        rangeDays,
        requests: null,
        errors: null,
        subrequests: null,
        errorRatePct: null,
        cpuTimeP50Ms: null,
        cpuTimeP99Ms: null,
        durationP50Ms: null,
        durationP99Ms: null,
        errorMessage: formatCloudflareAnalyticsError(raw),
      };
    }

    const row =
      json.data?.viewer?.accounts?.[0]?.workersInvocationsAdaptive?.[0];
    const sum = row?.sum;
    const q = row?.quantiles;
    const requests = sum?.requests ?? 0;
    const errors = sum?.errors ?? 0;
    const errorRatePct =
      requests > 0 ? Math.round((errors / requests) * 1000) / 10 : null;

    return {
      configured: true,
      dashboardUrl,
      rangeDays,
      requests,
      errors,
      subrequests: sum?.subrequests ?? null,
      errorRatePct,
      cpuTimeP50Ms: q?.cpuTimeP50 ?? null,
      cpuTimeP99Ms: q?.cpuTimeP99 ?? null,
      durationP50Ms: q?.durationP50 ?? null,
      durationP99Ms: q?.durationP99 ?? null,
    };
  } catch (err) {
    log.warn("cloudflare.analytics.fetch_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      configured: true,
      dashboardUrl,
      rangeDays,
      requests: null,
      errors: null,
      subrequests: null,
      errorRatePct: null,
      cpuTimeP50Ms: null,
      cpuTimeP99Ms: null,
      durationP50Ms: null,
      durationP99Ms: null,
      errorMessage: err instanceof Error ? err.message : "Fetch failed",
    };
  }
}

export function getObservabilityLinks(): {
  sentryUrl: string | null;
  neonConsoleUrl: string | null;
  posthogConfigured: boolean;
} {
  const org = process.env.SENTRY_ORG_SLUG?.trim();
  const project = process.env.SENTRY_PROJECT?.trim();
  const sentryUrl =
    org && project
      ? `https://sentry.io/organizations/${org}/projects/${project}/`
      : null;

  const neonConsoleUrl = process.env.NEON_CONSOLE_URL?.trim() || null;

  return {
    sentryUrl,
    neonConsoleUrl,
    posthogConfigured: Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim()),
  };
}
