import Link from "next/link";

import { getSupportEmail } from "@/lib/support";

export const metadata = {
  title: "Support — GradApply",
  description: "Contact support and check system status.",
};

export default function SupportPage() {
  const email = getSupportEmail();

  return (
    <div className="min-h-screen bg-[hsl(232_32%_8%)] px-4 py-16 text-white">
      <div className="mx-auto max-w-lg">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Support
        </h1>
        <p className="mt-2 text-sm text-white/60">
          Questions about your account, billing, or how to use GradApply—reach
          out and we’ll help.
        </p>

        <div className="mt-8 space-y-6 rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-sm">
          <section>
            <h2 className="text-sm font-medium text-white/90">Email</h2>
            {email ? (
              <p className="mt-2">
                <a
                  href={`mailto:${email}?subject=GradApply%20support`}
                  className="font-mono text-sm text-primary underline-offset-4 hover:underline"
                >
                  {email}
                </a>
              </p>
            ) : (
              <p className="mt-2 text-sm text-amber-200/90">
                Support email is not configured yet. If you run this app, set{" "}
                <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[11px]">
                  NEXT_PUBLIC_SUPPORT_EMAIL
                </code>{" "}
                in your environment and redeploy.
              </p>
            )}
            <p className="mt-3 text-xs text-white/45">
              We aim to reply within two business days. Include your account email
              and what you were trying to do so we can respond faster.
            </p>
          </section>

          <section className="border-t border-white/10 pt-6">
            <h2 className="text-sm font-medium text-white/90">
              System status
            </h2>
            <p className="mt-2 text-sm text-white/55">
              Check whether the app and database are reachable.
            </p>
            <Link
              href="/status"
              className="mt-3 inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              View status page →
            </Link>
          </section>

          <section className="border-t border-white/10 pt-6">
            <Link
              href="/login"
              className="text-sm text-white/55 underline-offset-4 hover:text-white hover:underline"
            >
              ← Back to sign in
            </Link>
          </section>
        </div>
      </div>
    </div>
  );
}
