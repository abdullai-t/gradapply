import Link from "next/link";

export const metadata = {
  title: "Terms of Service — GradApply",
  description: "Terms governing your use of GradApply.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[hsl(232_32%_8%)] px-4 py-16 text-white">
      <div className="mx-auto max-w-3xl rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-sm md:p-8">
        <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">
          Terms of Service
        </h1>
        <p className="mt-2 text-sm text-white/60">
          Last updated: April 29, 2026
        </p>

        <div className="mt-8 space-y-6 text-sm leading-relaxed text-white/80">
          <section>
            <h2 className="text-base font-semibold text-white">Use of service</h2>
            <p className="mt-2">
              GradApply provides tools for application planning, writing support,
              and workflow management. You agree to use the service lawfully and
              not attempt to abuse, disrupt, or reverse engineer protected parts
              of the platform.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white">
              Accounts and security
            </h2>
            <p className="mt-2">
              You are responsible for maintaining the confidentiality of your
              login credentials and for activity under your account.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white">Billing and plans</h2>
            <p className="mt-2">
              Paid features are billed according to your selected plan or credits
              purchase. Pricing may be updated over time and will be shown in the
              app before checkout.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white">
              AI-generated content
            </h2>
            <p className="mt-2">
              AI outputs are suggestions and may contain inaccuracies. You are
              responsible for reviewing and approving all final content before use
              or submission.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white">
              Suspension and termination
            </h2>
            <p className="mt-2">
              We may suspend or terminate access for violations of these terms or
              behavior that threatens platform security, reliability, or other
              users.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white">Contact</h2>
            <p className="mt-2">
              For questions about these terms, contact{" "}
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
