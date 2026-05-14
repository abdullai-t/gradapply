import Link from "next/link";

import { Icon } from "@/components/icon";
import { ContactForm } from "@/components/support/contact-form";
import { getSupportInboxEmail } from "@/lib/support";

function BackdropOrbs() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-0 overflow-hidden"
    >
      <div
        className="float-blob absolute -left-24 top-[-3rem] h-72 w-72 rounded-full"
        style={{
          background:
            "color-mix(in srgb, var(--primary-container) 28%, transparent)",
          filter: "blur(80px)",
        }}
      ></div>
      <div
        className="float-blob absolute -right-32 top-32 h-80 w-80 rounded-full"
        style={{
          background:
            "color-mix(in srgb, var(--secondary-container) 28%, transparent)",
          filter: "blur(90px)",
          animationDelay: "1.6s",
        }}
      ></div>
      <div
        className="float-blob absolute bottom-[-6rem] left-1/2 h-72 w-[34rem] -translate-x-1/2 rounded-full"
        style={{
          background:
            "color-mix(in srgb, var(--tertiary-container) 22%, transparent)",
          filter: "blur(100px)",
          animationDelay: "0.8s",
        }}
      ></div>
    </div>
  );
}

function BrandMark() {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className="grid h-11 w-11 place-items-center rounded-2xl text-white shadow-[0_4px_0_0_var(--on-primary-fixed-variant)]"
        style={{
          background:
            "linear-gradient(135deg, var(--primary-container), var(--primary))",
        }}
      >
        <Icon name="auto_stories" fill size={22} />
      </div>
      <div className="leading-tight">
        <div className="text-lg font-extrabold tracking-tight text-[var(--primary)]">
          GradApply
        </div>
        <div className="text-[9px] font-extrabold uppercase tracking-[0.16em] text-[var(--outline)]">
          Scholar Pursuit Hub
        </div>
      </div>
    </div>
  );
}

export function SupportPageContent() {
  const inboxConfigured = Boolean(getSupportInboxEmail());

  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--background)] text-[var(--on-background)]">
      <BackdropOrbs />

      <div className="relative mx-auto max-w-4xl px-4 py-10 sm:px-6 md:py-14">
        <Link
          href="/"
          aria-label="GradApply — back home"
          className="mb-8 inline-flex rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-container)]"
        >
          <BrandMark />
        </Link>

        <header className="mb-8 max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--primary-container)] bg-[var(--primary-fixed)] px-3.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[var(--primary)]">
            <Icon name="forum" size={14} />
            Contact us
          </span>
          <h1 className="t-headline-lg mt-4 text-balance text-[var(--on-surface)]">
            Tell us what is working — and what is not
          </h1>
          <p className="mt-3 text-base leading-relaxed text-[var(--on-surface-variant)]">
            Share product ideas, report a problem, or let us know when something
            missed the mark. Your feedback shapes what we build next.
          </p>
        </header>

        <section className="tactile-card rounded-3xl border-2 border-[var(--outline-variant)] p-8 md:p-10">
          <h2 className="t-headline-md m-0 text-[var(--on-surface)]">
            Send a message
          </h2>
          <p className="mt-2 text-sm text-[var(--on-surface-variant)]">
            Pick a topic, write freely, and we will follow up by email within
            about two business days.
          </p>
          <div className="mt-8">
            <ContactForm configured={inboxConfigured} />
          </div>
        </section>

        <footer className="mt-10 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-sm text-[var(--on-surface-variant)]">
          <Link
            href="/login"
            className="font-bold text-[var(--primary)] underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
          <span aria-hidden>·</span>
          <Link
            href="/"
            className="underline-offset-4 hover:text-[var(--primary)] hover:underline"
          >
            Home
          </Link>
          <span aria-hidden>·</span>
          <Link
            href="/privacy"
            className="underline-offset-4 hover:text-[var(--primary)] hover:underline"
          >
            Privacy
          </Link>
        </footer>
      </div>
    </div>
  );
}
