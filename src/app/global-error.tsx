"use client";

import Link from "next/link";
import { useEffect } from "react";

import "./globals.css";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
    if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
    void import("@sentry/nextjs").then((Sentry) => {
      Sentry.captureException(error);
    });
  }, [error]);

  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <div className="flex min-h-screen flex-col items-center justify-center px-4">
          <div className="max-w-md space-y-4 rounded-2xl border border-white/15 bg-[hsl(232_32%_11%/0.85)] p-8 text-center shadow-[0_12px_48px_-12px_rgba(0,0,0,0.45)] backdrop-blur-2xl ring-1 ring-amber-500/10">
            <h1 className="font-display text-xl font-semibold tracking-tight">
              Something went wrong
            </h1>
            <p className="text-sm text-muted-foreground">
              GradApply couldn&apos;t load this page. Try again or return home.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
              <button
                type="button"
                className="inline-flex h-9 items-center justify-center rounded-md border border-white/15 bg-white/[0.07] px-4 text-sm font-medium backdrop-blur-md transition-colors hover:bg-white/[0.12]"
                onClick={() => reset()}
              >
                Try again
              </button>
              <Link
                href="/dashboard"
                className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                Dashboard
              </Link>
            </div>
            <p className="text-xs text-muted-foreground">
              <Link href="/" className="underline-offset-4 hover:underline">
                Home
              </Link>
            </p>
          </div>
        </div>
      </body>
    </html>
  );
}
