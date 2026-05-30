import Link from "next/link";

import { Icon } from "@/components/icon";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--background)] text-[var(--on-background)]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div
          className="absolute -left-24 top-[-3rem] h-72 w-72 rounded-full"
          style={{
            background:
              "color-mix(in srgb, var(--primary-container) 28%, transparent)",
            filter: "blur(80px)",
          }}
        />
      </div>
      <div className="relative mx-auto flex min-h-screen max-w-3xl flex-col px-4 py-8 sm:px-6 md:py-12">
        <Link
          href="/"
          aria-label="GradApply — home"
          className="mb-10 self-center rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-container)]"
        >
          <div className="flex items-center gap-2.5">
            <div
              className="grid h-11 w-11 place-items-center rounded-2xl text-white"
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
                Getting started
              </div>
            </div>
          </div>
        </Link>
        {children}
      </div>
    </div>
  );
}
