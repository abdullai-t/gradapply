import * as Sentry from "@sentry/nextjs";

/** Client bundles only expose env vars prefixed with NEXT_PUBLIC_. */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1,
    environment:
      process.env.NEXT_PUBLIC_VERCEL_ENV ??
      process.env.VERCEL_ENV ??
      process.env.NODE_ENV,
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
