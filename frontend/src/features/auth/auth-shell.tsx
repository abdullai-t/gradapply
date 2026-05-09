import Link from "next/link";

import { Icon } from "@/components/icon";
import { cn } from "@/lib/utils";

/**
 * Shared frame for /login and /register. Provides:
 *   - Tactile-tinted background with ambient orbs (matches landing hero).
 *   - GradApply brand mark above the card.
 *   - White tactile card hosting the form.
 *   - Footer link rail.
 *
 * Pure layout — owns no auth state.
 */
export function AuthShell({
  title,
  description,
  children,
  footer,
  topBanners,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Banners rendered above the card (info / warning / error). */
  topBanners?: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--background)] text-[var(--on-background)]">
      <BackdropOrbs />
      <div className="relative mx-auto flex min-h-screen max-w-md flex-col px-4 py-10 md:py-14">
        <Link
          href="/"
          aria-label="GradApply — back home"
          className="mb-8 self-center rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-container)]"
        >
          <BrandMark />
        </Link>

        {topBanners ? <div className="mb-5 space-y-3">{topBanners}</div> : null}

        <div
          className={cn(
            "tactile-card rounded-3xl border-2 border-[var(--outline-variant)] p-7 md:p-8",
          )}
        >
          <header className="mb-6 space-y-1.5">
            <h1 className="t-headline-md m-0 text-[var(--on-surface)]">
              {title}
            </h1>
            <p className="m-0 text-sm leading-relaxed text-[var(--on-surface-variant)]">
              {description}
            </p>
          </header>
          {children}
        </div>

        {footer ? (
          <div className="mt-7 text-center text-sm text-[var(--on-surface-variant)]">
            {footer}
          </div>
        ) : null}
      </div>
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

function BackdropOrbs() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-0 overflow-hidden"
    >
      <div
        className="float-blob absolute -left-24 top-[-3rem] h-72 w-72 rounded-full"
        style={{
          background: "color-mix(in srgb, var(--primary-container) 28%, transparent)",
          filter: "blur(80px)",
        }}
      />
      <div
        className="float-blob absolute -right-32 top-32 h-80 w-80 rounded-full"
        style={{
          background: "color-mix(in srgb, var(--secondary-container) 28%, transparent)",
          filter: "blur(90px)",
          animationDelay: "1.6s",
        }}
      />
      <div
        className="float-blob absolute bottom-[-6rem] left-1/2 h-72 w-[34rem] -translate-x-1/2 rounded-full"
        style={{
          background: "color-mix(in srgb, var(--tertiary-container) 22%, transparent)",
          filter: "blur(100px)",
          animationDelay: "0.8s",
        }}
      />
    </div>
  );
}

/** Inline divider — used between auth methods (e.g. password / Google / magic link). */
export function AuthDivider({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative my-6">
      <div className="absolute inset-0 flex items-center">
        <span className="w-full border-t border-[var(--outline-variant)]" />
      </div>
      <div className="relative flex justify-center">
        <span className="rounded-full border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-[var(--outline)]">
          {children}
        </span>
      </div>
    </div>
  );
}

/** Branded label for Google sign-in button. */
export function GoogleButtonContent() {
  return (
    <span className="inline-flex items-center gap-2">
      <Icon name="login" size={18} />
      Continue with Google
    </span>
  );
}
