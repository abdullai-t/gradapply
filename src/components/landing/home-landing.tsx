import Image from "next/image";
import Link from "next/link";

import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import {
  creditsPackSize,
  monthlyAiAllowanceForTier,
} from "@/lib/billing-config";
import { cn } from "@/lib/utils";

import { RevealOnScroll } from "./reveal-on-scroll";
import { WorkspaceShowcase } from "./workspace-showcase";

/** Illustrative USD amounts when Stripe/Paystack checkout is enabled; exact
 * totals at checkout. Real prices are admin-configured in `BillingAdminConfig`. */
const ILLUSTR_PLUS_USD = "14";
const ILLUSTR_PRO_USD = "39";

export function HomeLanding({ showPricing }: { showPricing: boolean }) {
  const aiFree = monthlyAiAllowanceForTier("FREE");
  const aiPlus = monthlyAiAllowanceForTier("PLUS");
  const aiPro = monthlyAiAllowanceForTier("PRO");
  const creditsPack = creditsPackSize();

  return (
    <div className="bg-[var(--background)] text-[var(--on-background)]">
      {/* Reveal-on-scroll CSS — scoped to landing only via the `.reveal-base` selector */}
      <style>{`
        .reveal-base { opacity: 0; transition: all 0.7s cubic-bezier(0.34, 1.56, 0.64, 1); }
        .reveal-up { transform: translateY(40px); }
        .reveal-left { transform: translateX(-50px); }
        .reveal-right { transform: translateX(50px); }
        .reveal-parallax { transform: scale(0.94) translateY(20px); }
        .reveal-base.active { opacity: 1; transform: translate(0,0) scale(1); }
        .stagger-1 { transition-delay: 80ms; }
        .stagger-2 { transition-delay: 160ms; }
        .stagger-3 { transition-delay: 240ms; }
        .stagger-4 { transition-delay: 320ms; }
        @media (prefers-reduced-motion: reduce) {
          .reveal-base { opacity: 1 !important; transform: none !important; transition: none !important; }
        }
      `}</style>
      <RevealOnScroll />

      <LandingHeader showPricing={showPricing} />

      <main className="relative">
        {/* ============== Hero ============== */}
        <section className="relative overflow-hidden">
          <BackgroundOrbs />
          <div className="relative mx-auto grid max-w-7xl items-center gap-16 px-6 pb-20 pt-16 md:pb-28 md:pt-24 lg:grid-cols-[1.05fr_1fr]">
            {/* Left — copy */}
            <div className="reveal-base reveal-left">
              <span className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--primary-container)] bg-[var(--primary-fixed)] px-4 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.12em] text-[var(--primary)]">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--primary-container)] opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--primary)]" />
                </span>
                with AI assistant
              </span>
              <h1 className="t-display-xl mt-7 text-balance text-[var(--on-background)]">
                One calm command center for{" "}
                <span className="relative inline-block text-[var(--primary)]">
                  every application
                  <Underline />
                </span>{" "}
                you care about.
              </h1>
              <p className="t-body-lg mt-7 max-w-xl text-pretty text-[var(--on-surface-variant)]">
                GradApply exists so you spend less time juggling spreadsheets
                and inboxes, and more time on research fit, faculty outreach,
                and stories only you can tell. Track schools and deadlines,
                draft professor emails with guardrails, version your SOP and
                CV, and use AI where it helps — without losing your voice.
              </p>
              <div className="mt-10 flex flex-wrap items-center gap-3">
                <Button asChild size="lg" iconRight="arrow_forward">
                  <Link href="/register">Start free</Link>
                </Button>
                <Button asChild size="lg" variant="secondary">
                  <Link href="/login">I already have an account</Link>
                </Button>
              </div>
              <p className="mt-6 text-xs text-[var(--outline)]">
                Optional Google connectors · Document storage · AI tuned for
                application writing
              </p>
            </div>

            {/* Right — rotated dashboard screenshot */}
            <div className="reveal-base reveal-parallax relative">
              <div
                className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-[var(--primary-container)]/15 blur-3xl"
                aria-hidden
              />
              <div
                className="pointer-events-none absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-[var(--secondary-container)]/15 blur-3xl"
                aria-hidden
              />
              <div className="glass-panel relative rotate-2 rounded-[2rem] border border-white/40 p-3 shadow-2xl transition-transform duration-500 hover:rotate-0">
                <Image
                  src="/landing/dashboard-hero.png"
                  alt="GradApply dashboard preview — streak card, readiness gauge, stat tiles, and daily mission"
                  width={1440}
                  height={900}
                  className="w-full rounded-[1.5rem]"
                  priority
                />
              </div>
            </div>
          </div>
        </section>

        {/* ============== Vision pillars (3 cards w/ per-card CTA) ============== */}
        <section
          id="vision"
          className="scroll-mt-24 border-t border-[var(--outline-variant)] bg-[var(--surface-container-low)] py-20 md:py-28"
        >
          <div className="mx-auto max-w-7xl px-6">
            <SectionHeading
              eyebrow="Why GradApply"
              title="Clarity. Structure. Momentum."
              body={
                <>
                  Applying is emotional and logistical at once. The product
                  vision is simple: give you{" "}
                  <strong className="font-bold text-[var(--on-surface)]">
                    clarity
                  </strong>
                  ,{" "}
                  <strong className="font-bold text-[var(--on-surface)]">
                    structure
                  </strong>
                  , and{" "}
                  <strong className="font-bold text-[var(--on-surface)]">
                    momentum
                  </strong>{" "}
                  until you hit submit — then celebrate.
                </>
              }
            />
            <div className="mt-14 grid gap-6 md:grid-cols-3">
              <ValueCard
                tone="primary"
                icon="explore"
                title="Clarity over chaos"
                body="A single timeline and pipeline for programs, requirements, and deadlines — so nothing lives only in your head or buried in email threads."
                cta={{ label: "Explore workspace", href: "/login" }}
              />
              <ValueCard
                tone="tertiary"
                icon="mail"
                title="Outreach that sounds like you"
                body="Professor emails deserve research and tone. Draft with AI assistance, iterate with version history, and send when it actually reflects your fit."
                cta={{ label: "View studio", href: "/login" }}
              />
              <ValueCard
                tone="secondary"
                icon="auto_awesome"
                title="AI as a skilled editor"
                body="Grammar, structure, and strategic feedback — not a replacement for your judgment. Bonus credits and monthly allowances keep usage predictable."
                cta={{ label: "Try AI editor", href: "/login" }}
              />
            </div>
          </div>
        </section>

        {/* ============== Workspace Showcase ============== */}
        <section
          id="workspace"
          className="scroll-mt-24 py-20 md:py-28"
        >
          <div className="mx-auto max-w-7xl px-6">
            <div className="reveal-base reveal-left mb-14 flex flex-col justify-between gap-8 md:flex-row md:items-end">
              <div className="max-w-xl">
                <div className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.12em] text-[var(--primary)]">
                  Inside the product
                </div>
                <h2 className="t-headline-lg m-0 text-[var(--on-surface)]">
                  Everything in one place
                </h2>
                <p className="mt-3 text-[15px] text-[var(--on-surface-variant)]">
                  The most powerful suite of tools ever built for the modern
                  applicant. Tap any feature below to preview it.
                </p>
              </div>
              <div className="flex gap-2">
                <span className="h-1.5 w-12 rounded-full bg-[var(--primary)]" />
                <span className="h-1.5 w-4 rounded-full bg-[var(--outline-variant)]" />
                <span className="h-1.5 w-4 rounded-full bg-[var(--outline-variant)]" />
              </div>
            </div>
            <div className="reveal-base reveal-right">
              <WorkspaceShowcase />
            </div>
          </div>
        </section>

        {/* ============== Features grid (6 tiles) ============== */}
        <section
          id="features"
          className="scroll-mt-24 border-t border-[var(--outline-variant)] bg-[var(--surface-container-low)] py-20 md:py-28"
        >
          <div className="mx-auto max-w-7xl px-6">
            <SectionHeading
              eyebrow="Workspace"
              title="Built around how you actually work"
              body="Shortlist. Reach out. Refine. Ship — before the clock runs out."
            />
            <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <FeatureTile
                tone="primary"
                icon="track_changes"
                title="School pipeline"
                body="Track programs, statuses, and deadlines with reminders so rolling admissions don't surprise you."
              />
              <FeatureTile
                tone="tertiary"
                icon="event_available"
                title="Application timeline"
                body="See what's coming across schools in one view — fewer spreadsheet tabs, fewer near-misses."
              />
              <FeatureTile
                tone="secondary"
                icon="forum"
                title="Professor email studio"
                body="Draft outreach and follow-ups with AI modes suited to academic tone — refine until you're proud to send."
              />
              <FeatureTile
                tone="primary"
                icon="folder_managed"
                title="Documents & versions"
                body="Upload SOPs, CVs, and supporting files with snapshots when you need to roll back a paragraph."
              />
              <FeatureTile
                tone="tertiary"
                icon="psychology"
                title="Writing & chat assistant"
                body="Grammar passes, structural suggestions, and feedback loops for statements and emails."
              />
              <FeatureTile
                tone="secondary"
                icon="link"
                title="Optional Google hooks"
                body="Connect Gmail or Drive when you want your workflow closer to where files and threads already live."
              />
            </div>
          </div>
        </section>

        {/* ============== How it works (3 steps + connecting line) ============== */}
        <section
          id="how"
          className="scroll-mt-24 bg-white py-20 md:py-28"
        >
          <div className="mx-auto max-w-6xl px-6">
            <SectionHeading
              eyebrow="The arc"
              title="From curiosity to confirmation"
              body="Three stages most applicants repeat until applications are in."
            />
            <div className="relative mt-14 grid gap-12 md:grid-cols-3">
              <div
                className="absolute left-0 top-8 hidden h-0.5 w-full bg-[var(--surface-container-high)] md:block"
                aria-hidden
              />
              <Step
                step={1}
                title="Build your shortlist"
                body="Add schools, note requirements, and let deadlines surface on your dashboard and timeline."
              />
              <Step
                step={2}
                title="Draft with intention"
                body="Shape outreach and statements with AI help, then revise with versions and your own standards."
              />
              <Step
                step={3}
                title="Submit with confidence"
                body="Upload finals, track what's sent, and keep momentum through rolling decisions."
              />
            </div>
          </div>
        </section>

        {/* ============== Pricing trio (gated by feature flag) ============== */}
        {showPricing ? (
          <section
            id="pricing"
            className="scroll-mt-24 py-20 md:py-28"
          >
            <div className="mx-auto max-w-7xl px-6">
              <SectionHeading
                eyebrow="Pricing"
                title="Start free, upgrade when it pays for itself"
                body="Higher monthly AI allowances and more room for drafts, discovery, and polish. Exact charges depend on how your deployment configures Stripe or Paystack."
              />
              <div className="mt-14 grid gap-6 lg:grid-cols-3 lg:items-stretch">
                <PricingCard
                  name="Free"
                  price="$0"
                  period=""
                  description="Explore the workspace and stay organized."
                  cta={{ href: "/register", label: "Create account" }}
                  variant="default"
                  bullets={[
                    `${aiFree} AI actions / month`,
                    "School pipeline & timeline",
                    "Professor email drafting",
                    "Documents & basic assistant",
                  ]}
                />
                <PricingCard
                  name="Plus"
                  price={`$${ILLUSTR_PLUS_USD}`}
                  period="/ mo · illustrative"
                  description="For applicants running several serious apps."
                  cta={{ href: "/register", label: "Start with Plus" }}
                  variant="highlight"
                  bullets={[
                    `${aiPlus} AI actions / month`,
                    "Everything in Free",
                    "Higher throughput for drafts & iterations",
                    `Credit packs (+${creditsPack} per pack)`,
                  ]}
                />
                <PricingCard
                  name="Pro"
                  price={`$${ILLUSTR_PRO_USD}`}
                  period="/ mo · illustrative"
                  description="Heavy usage: many schools, many drafts, tight timelines."
                  cta={{ href: "/register", label: "Start with Pro" }}
                  variant="default"
                  bullets={[
                    `${aiPro} AI actions / month`,
                    "Everything in Plus",
                    "Best for parallel programs and frequent AI passes",
                    "Same credit packs where checkout is enabled",
                  ]}
                />
              </div>
              <p className="mx-auto mt-10 max-w-2xl text-center text-xs leading-relaxed text-[var(--outline)]">
                AI &ldquo;actions&rdquo; cover assistant work like drafts, chat
                turns, and discovery flows; bonus credits spend first. Dollar
                amounts are{" "}
                <strong className="font-bold text-[var(--on-surface-variant)]">
                  examples
                </strong>{" "}
                only — your administrator sets real prices and providers.
              </p>
            </div>
          </section>
        ) : null}

        {/* ============== FAQ ============== */}
        <section
          id="faq"
          className="scroll-mt-24 border-t border-[var(--outline-variant)] bg-[var(--surface-container-low)] py-20 md:py-28"
        >
          <div className="mx-auto max-w-3xl px-6">
            <SectionHeading
              eyebrow="FAQ"
              title="Common questions"
              body=""
              centered
            />
            <div className="mt-12 space-y-4">
              <FaqCard
                q="Do I need a credit card to try GradApply?"
                a="No. You can create an account and use the Free tier without payment. Paid tiers appear when your deployment enables billing (Stripe or Paystack)."
              />
              <FaqCard
                q="Will AI write my statement of purpose for me?"
                a="GradApply is built so AI supports editing and structure — you stay the author. Use suggestions as a springboard, then revise until the story is unmistakably yours."
              />
              <FaqCard
                q="Can I use this without Google?"
                a="Yes. Google connectors are optional. Core tracking, email drafting, documents, and assistant features work with email/password or other sign-in your host configures."
              />
              <FaqCard
                q="Can I export my data?"
                a="Yes. Schools, documents, and email drafts can be exported anytime. Your data is yours — we don't lock it in."
              />
            </div>
          </div>
        </section>

        {/* ============== Final CTA (gradient w/ float-blob orbs) ============== */}
        <section className="px-6 pb-24">
          <div className="mx-auto max-w-7xl">
            <div
              className="reveal-base reveal-up relative overflow-hidden rounded-[2.5rem] p-12 text-center text-white md:p-24"
              style={{
                background:
                  "linear-gradient(135deg, var(--primary-container), var(--primary))",
                boxShadow: "0 24px 60px -20px rgba(0,98,157,0.45)",
              }}
            >
              <div
                className="float-blob pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-3xl"
                aria-hidden
              />
              <div
                className="float-blob pointer-events-none absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-[var(--secondary-container)]/20 blur-3xl"
                aria-hidden
              />
              <div className="relative mx-auto max-w-2xl">
                <h2 className="t-display-lg m-0 leading-tight">
                  Ready to make this cycle feel manageable?
                </h2>
                <p className="mt-6 text-lg opacity-90">
                  Join scholars who use GradApply to navigate their futures —
                  one calm command center for every application.
                </p>
                <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
                  <Button
                    asChild
                    size="lg"
                    className="bg-white text-[var(--primary)] hover:bg-white"
                    iconRight="arrow_forward"
                  >
                    <Link href="/register">Create your workspace</Link>
                  </Button>
                  <Button
                    asChild
                    size="lg"
                    variant="ghost"
                    className="border-2 border-white/40 text-white hover:bg-white/10"
                  >
                    <Link href="/login">Sign in</Link>
                  </Button>
                </div>
                <p className="mt-6 text-xs opacity-75">
                  No credit card required · Free forever plan available
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer showPricing={showPricing} />
    </div>
  );
}

/* ====================== Header & Footer ====================== */

function LandingHeader({ showPricing }: { showPricing: boolean }) {
  return (
    <header className="glass-header sticky top-0 z-50">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-4">
        <Link
          href="/"
          className="min-w-0 shrink rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-container)]"
        >
          <BrandMark />
        </Link>

        <nav
          className="hidden items-center gap-7 text-sm font-bold text-[var(--on-surface-variant)] md:flex"
          aria-label="Page sections"
        >
          <a href="#vision" className="transition-colors hover:text-[var(--primary)]">
            Vision
          </a>
          <a
            href="#workspace"
            className="transition-colors hover:text-[var(--primary)]"
          >
            Workspace
          </a>
          <a href="#features" className="transition-colors hover:text-[var(--primary)]">
            Features
          </a>
          <a href="#how" className="transition-colors hover:text-[var(--primary)]">
            How it works
          </a>
          {showPricing ? (
            <a
              href="#pricing"
              className="transition-colors hover:text-[var(--primary)]"
            >
              Pricing
            </a>
          ) : null}
          <a href="#faq" className="transition-colors hover:text-[var(--primary)]">
            FAQ
          </a>
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <Button asChild size="sm" variant="ghost">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild size="sm" iconRight="arrow_forward">
            <Link href="/register">Get started</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

function BrandMark() {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className="grid h-9 w-9 place-items-center rounded-xl text-white shadow-[0_3px_0_0_var(--on-primary-fixed-variant)]"
        style={{
          background:
            "linear-gradient(135deg, var(--primary-container), var(--primary))",
        }}
      >
        <Icon name="auto_stories" fill size={20} />
      </div>
      <div className="leading-tight">
        <div className="text-base font-extrabold tracking-tight text-[var(--primary)]">
          GradApply
        </div>
        <div className="text-[9px] font-extrabold uppercase tracking-[0.15em] text-[var(--outline)]">
          Scholar Pursuit Hub
        </div>
      </div>
    </div>
  );
}

function Footer({ showPricing }: { showPricing: boolean }) {
  return (
    <footer className="border-t border-[var(--outline-variant)] bg-[var(--surface-container-low)] py-5">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-6 text-sm text-[var(--on-surface-variant)] md:flex-row">
        <BrandMark />
        <div className="flex flex-wrap justify-center gap-6">
          <a href="#features" className="hover:text-[var(--primary)]">
            Features
          </a>
          {showPricing ? (
            <a href="#pricing" className="hover:text-[var(--primary)]">
              Pricing
            </a>
          ) : null}
          <Link href="/login" className="hover:text-[var(--primary)]">
            Sign in
          </Link>
          <Link href="/register" className="hover:text-[var(--primary)]">
            Register
          </Link>
          <Link href="/support" className="hover:text-[var(--primary)]">
            Support
          </Link>
        </div>
        <p className="text-xs">© {new Date().getFullYear()} GradApply</p>
      </div>
    </footer>
  );
}

/* ====================== Section primitives ====================== */

function SectionHeading({
  eyebrow,
  title,
  body,
  centered = true,
}: {
  eyebrow: string;
  title: string;
  body: React.ReactNode;
  centered?: boolean;
}) {
  return (
    <div
      className={
        "reveal-base reveal-up " +
        (centered ? "mx-auto max-w-3xl text-center" : "max-w-3xl")
      }
    >
      <div className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[var(--primary)]">
        {eyebrow}
      </div>
      <h2 className="t-headline-lg mt-3 text-[var(--on-surface)]">{title}</h2>
      {body ? (
        <p className="mt-4 text-[15px] text-[var(--on-surface-variant)]">
          {body}
        </p>
      ) : null}
    </div>
  );
}

function ValueCard({
  tone,
  icon,
  title,
  body,
  cta,
}: {
  tone: "primary" | "secondary" | "tertiary";
  icon: string;
  title: string;
  body: string;
  cta: { label: string; href: string };
}) {
  const tile = TILE_STYLES[tone];
  return (
    <div className="reveal-base reveal-up group flex flex-col rounded-2xl border border-[var(--outline-variant)] bg-white p-8 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md">
      <div
        className="mb-7 grid h-16 w-16 place-items-center rounded-2xl shadow-inner transition-transform group-hover:rotate-6"
        style={{ background: tile.bg, color: tile.fg }}
      >
        <Icon name={icon} fill size={32} />
      </div>
      <h3 className="t-headline-md m-0 mb-3 text-[var(--on-surface)]">
        {title}
      </h3>
      <p className="m-0 mb-7 flex-1 text-[14px] leading-relaxed text-[var(--on-surface-variant)]">
        {body}
      </p>
      <Link
        href={cta.href}
        className="inline-flex items-center justify-center rounded-xl border-2 border-[var(--outline-variant)] px-4 py-3 text-sm font-extrabold tracking-tight text-[var(--on-surface)] transition-all group-hover:border-[var(--primary)] group-hover:text-[var(--primary)] active:translate-y-0.5"
      >
        {cta.label}
        <Icon name="arrow_forward" size={16} className="ml-1.5" />
      </Link>
    </div>
  );
}

function FeatureTile({
  tone,
  icon,
  title,
  body,
}: {
  tone: "primary" | "secondary" | "tertiary";
  icon: string;
  title: string;
  body: string;
}) {
  const tile = TILE_STYLES[tone];
  return (
    <div className="reveal-base reveal-up rounded-2xl border border-[var(--outline-variant)] bg-white p-6 transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div
        className="mb-5 grid h-12 w-12 place-items-center rounded-xl"
        style={{ background: tile.bg, color: tile.fg }}
      >
        <Icon name={icon} fill size={24} />
      </div>
      <h4 className="m-0 text-base font-extrabold tracking-tight text-[var(--on-surface)]">
        {title}
      </h4>
      <p className="m-0 mt-1.5 text-[13px] leading-relaxed text-[var(--on-surface-variant)]">
        {body}
      </p>
    </div>
  );
}

function Step({
  step,
  title,
  body,
}: {
  step: number;
  title: string;
  body: string;
}) {
  return (
    <div className="reveal-base reveal-up relative flex flex-col items-center bg-white text-center">
      <div
        className="z-10 mb-6 grid h-16 w-16 place-items-center rounded-full border-4 border-white text-2xl font-black text-white shadow-[0_6px_0_0_var(--on-primary-fixed-variant)] transition-transform hover:scale-110"
        style={{ background: "var(--primary)" }}
      >
        {step}
      </div>
      <h4 className="t-headline-md m-0 text-[var(--on-surface)]">{title}</h4>
      <p className="mt-3 max-w-xs text-[14px] leading-relaxed text-[var(--on-surface-variant)]">
        {body}
      </p>
    </div>
  );
}

function PricingCard({
  name,
  price,
  period,
  description,
  bullets,
  cta,
  variant,
}: {
  name: string;
  price: string;
  period: string;
  description: string;
  bullets: string[];
  cta: { href: string; label: string };
  variant: "default" | "highlight";
}) {
  const highlight = variant === "highlight";
  return (
    <div
      className={cn(
        "reveal-base reveal-up tactile-card flex flex-col rounded-3xl border-2 bg-white p-8",
        highlight
          ? "border-[var(--primary)] [box-shadow:var(--tactile-secondary)]"
          : "border-[var(--outline-variant)]",
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-xl font-extrabold tracking-tight text-[var(--on-surface)]">
          {name}
        </h3>
        {highlight ? (
          <span className="rounded-full bg-[var(--primary-fixed)] px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-[var(--primary)]">
            Popular
          </span>
        ) : null}
      </div>
      <div className="mt-4 flex flex-wrap items-baseline gap-1.5">
        <span className="text-5xl font-black tracking-tight tabular-nums text-[var(--on-surface)]">
          {price}
        </span>
        {period ? (
          <span className="text-sm text-[var(--on-surface-variant)]">
            {period}
          </span>
        ) : null}
      </div>
      <p className="mt-3 text-sm text-[var(--on-surface-variant)]">
        {description}
      </p>
      <ul className="mt-7 flex-1 space-y-3 text-sm text-[var(--on-surface-variant)]">
        {bullets.map((line) => (
          <li key={line} className="flex gap-2">
            <Icon
              name="check_circle"
              fill
              size={18}
              className="mt-0.5 shrink-0 text-[var(--primary)]"
            />
            <span>{line}</span>
          </li>
        ))}
      </ul>
      <Button
        asChild
        className="mt-8 w-full"
        size="lg"
        variant={highlight ? "primary" : "secondary"}
      >
        <Link href={cta.href}>{cta.label}</Link>
      </Button>
    </div>
  );
}

function FaqCard({ q, a }: { q: string; a: string }) {
  return (
    <details className="reveal-base reveal-up tactile-card group overflow-hidden rounded-2xl border border-[var(--outline-variant)] bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between p-6 text-left transition-colors hover:bg-[var(--surface-container-low)]">
        <span className="text-sm font-bold text-[var(--on-surface)] group-hover:text-[var(--primary)]">
          {q}
        </span>
        <Icon
          name="expand_more"
          size={20}
          className="text-[var(--outline)] transition-transform group-open:rotate-180"
        />
      </summary>
      <div className="px-6 pb-6 text-[14px] leading-relaxed text-[var(--on-surface-variant)]">
        {a}
      </div>
    </details>
  );
}

function Underline() {
  return (
    <svg
      aria-hidden
      className="absolute -bottom-2 left-0 h-2.5 w-full"
      viewBox="0 0 200 8"
      preserveAspectRatio="none"
    >
      <path
        d="M2 6 Q 50 0, 100 5 T 198 4"
        stroke="var(--primary-container)"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

function BackgroundOrbs() {
  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-[34rem] overflow-hidden"
      aria-hidden
    >
      <div
        className="float-blob absolute left-[10%] top-12 h-48 w-48 rounded-full"
        style={{
          background:
            "color-mix(in srgb, var(--primary-container) 30%, transparent)",
          filter: "blur(60px)",
        }}
      />
      <div
        className="float-blob absolute right-[12%] top-28 h-64 w-64 rounded-full"
        style={{
          background:
            "color-mix(in srgb, var(--secondary-container) 35%, transparent)",
          filter: "blur(70px)",
          animationDelay: "1.5s",
        }}
      />
      <div
        className="float-blob absolute left-1/2 top-0 h-40 w-[34rem] -translate-x-1/2 rounded-full"
        style={{
          background:
            "color-mix(in srgb, var(--tertiary-container) 25%, transparent)",
          filter: "blur(80px)",
        }}
      />
    </div>
  );
}

const TILE_STYLES: Record<
  "primary" | "secondary" | "tertiary",
  { bg: string; fg: string }
> = {
  primary: {
    bg: "var(--primary-fixed)",
    fg: "var(--primary)",
  },
  secondary: {
    bg: "var(--secondary-container)",
    fg: "var(--on-secondary-container)",
  },
  tertiary: {
    bg: "var(--tertiary-fixed)",
    fg: "var(--on-tertiary-container)",
  },
};
