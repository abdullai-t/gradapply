import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — GradApply",
  description: "How GradApply collects, uses, and protects your data.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[hsl(232_32%_8%)] px-4 py-16 text-white">
      <div className="mx-auto max-w-3xl rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-sm md:p-8">
        <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">
          Privacy Policy
        </h1>
        <p className="mt-2 text-sm text-white/60">
          Last updated: April 29, 2026
        </p>

        <div className="mt-8 space-y-6 text-sm leading-relaxed text-white/80">
          <section>
            <h2 className="text-base font-semibold text-white">What we collect</h2>
            <p className="mt-2">
              We collect account information (such as name and email), profile
              details you provide, schools and application data you enter,
              documents you upload, and usage events needed to run billing and
              product analytics.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white">How we use data</h2>
            <p className="mt-2">
              We use your data to provide core GradApply features, personalize AI
              generation for SOP and email workflows, process billing, improve
              reliability, and provide support.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white">
              AI and uploaded documents
            </h2>
            <p className="mt-2">
              Documents may be parsed to extract machine-readable text used as
              context for AI-assisted features. Extracted content is used for your
              workspace workflows and is not sold to third parties.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white">
              Data sharing and processors
            </h2>
            <p className="mt-2">
              We use service providers for hosting, storage, authentication,
              billing, and AI inference. These providers process data only as
              needed to operate the service on our behalf.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white">Your choices</h2>
            <p className="mt-2">
              You can update profile information, remove content you no longer
              need, and contact support for account-related requests.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white">Contact</h2>
            <p className="mt-2">
              For privacy questions, contact{" "}
              <a
                href="mailto:support@mygradapply.com"
                className="text-primary underline-offset-4 hover:underline"
              >
                support@mygradapply.com
              </a>
              .
            </p>
          </section>
        </div>

        <div className="mt-8 border-t border-white/10 pt-6">
          <Link
            href="/"
            className="text-sm text-white/60 underline-offset-4 hover:text-white hover:underline"
          >
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
