import type { ComponentType } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CalendarRange,
  Check,
  Compass,
  FileStack,
  Mail,
  MessageSquareText,
  Sparkles,
  Target,
  Zap,
} from "lucide-react";

import { GlassBrandMark } from "@/components/layout/glass-scene";
import { Button } from "@/components/ui/button";
import { creditsPackSize, monthlyAiAllowanceForTier } from "@/lib/billing-config";
import { cn } from "@/lib/utils";

/** Illustrative USD amounts when Stripe/Paystack checkout is enabled; exact totals at checkout. */
const ILLUSTR_PLUS_USD = "14";
const ILLUSTR_PRO_USD = "39";

export function HomeLanding() {
  const aiFree = monthlyAiAllowanceForTier("FREE");
  const aiPlus = monthlyAiAllowanceForTier("PLUS");
  const aiPro = monthlyAiAllowanceForTier("PRO");
  const creditsPack = creditsPackSize();

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[hsl(230_35%_7%/0.82)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <Link href="/" className="min-w-0 shrink">
            <GlassBrandMark compact />
          </Link>

          <nav
            className="hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex"
            aria-label="Page sections"
          >
            <a href="#vision" className="transition-colors hover:text-foreground">
              Vision
            </a>
            <a href="#features" className="transition-colors hover:text-foreground">
              Features
            </a>
            <a href="#how" className="transition-colors hover:text-foreground">
              How it works
            </a>
            <a href="#pricing" className="transition-colors hover:text-foreground">
              Pricing
            </a>
            <a href="#faq" className="transition-colors hover:text-foreground">
              FAQ
            </a>
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <Link href="/login">
              <Button variant="glass" size="sm">
                Sign in
              </Button>
            </Link>
            <Link href="/register">
              <Button size="sm">
                Get started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>

          <details className="relative w-full border-t border-white/10 pt-4 md:hidden">
            <summary className="cursor-pointer list-none text-center text-sm font-medium text-muted-foreground marker:hidden [&::-webkit-details-marker]:hidden">
              Menu
            </summary>
            <nav className="mt-4 flex flex-col gap-3 text-sm font-medium text-muted-foreground">
              <a href="#vision" className="py-1 hover:text-foreground">
                Vision
              </a>
              <a href="#features" className="py-1 hover:text-foreground">
                Features
              </a>
              <a href="#how" className="py-1 hover:text-foreground">
                How it works
              </a>
              <a href="#pricing" className="py-1 hover:text-foreground">
                Pricing
              </a>
              <a href="#faq" className="py-1 hover:text-foreground">
                FAQ
              </a>
            </nav>
          </details>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative mx-auto max-w-6xl px-6 pb-20 pt-12 md:pb-28 md:pt-16">
          <div className="mx-auto max-w-3xl text-center">
            <span className="glass-badge border-primary/25 text-foreground/85">
              Graduate admissions, treated like a serious project
            </span>
            <h1 className="mt-8 font-display text-balance text-4xl font-semibold tracking-tight md:text-6xl md:leading-[1.06]">
              One calm command center for every application you care about.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground md:text-xl">
              GradApply exists so you spend less time juggling spreadsheets and inboxes,
              and more time on research fit, faculty outreach, and stories only you can
              tell. Track schools and deadlines, draft professor emails with guardrails,
              version your SOP and CV, and use AI where it helps — without losing your
              voice.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <Link href="/register">
                <Button
                  size="lg"
                  className="shadow-[0_12px_40px_-8px_hsl(var(--primary)/0.55)]"
                >
                  Start free
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/login">
                <Button size="lg" variant="glass">
                  I already have an account
                </Button>
              </Link>
            </div>
            <p className="mt-6 text-xs text-muted-foreground">
              Optional Google connectors · Document storage · AI tuned for application
              writing
            </p>
          </div>
        </section>

        {/* Vision pillars */}
        <section
          id="vision"
          className="scroll-mt-24 border-t border-white/10 bg-black/20 py-20 md:py-28"
        >
          <div className="mx-auto max-w-6xl px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
                Why GradApply
              </h2>
              <p className="mt-4 text-pretty text-muted-foreground md:text-lg">
                Applying is emotional and logistical at once. The product vision is
                simple: give you{" "}
                <strong className="font-medium text-foreground">clarity</strong>,{" "}
                <strong className="font-medium text-foreground">structure</strong>, and{" "}
                <strong className="font-medium text-foreground">momentum</strong> until
                you hit submit — then celebrate.
              </p>
            </div>

            <div className="mt-16 grid gap-8 md:grid-cols-3">
              <VisionCard
                icon={Compass}
                title="Clarity over chaos"
                description="A single timeline and pipeline for programs, requirements, and deadlines — so nothing lives only in your head or buried in email threads."
              />
              <VisionCard
                icon={Mail}
                title="Outreach that sounds like you"
                description="Professor emails deserve research and tone. Draft with AI assistance, iterate with version history, and send when it actually reflects your fit."
              />
              <VisionCard
                icon={Sparkles}
                title="AI as a skilled editor"
                description="Grammar, structure, and strategic feedback — not a replacement for your judgment. Bonus credits and monthly allowances keep usage predictable."
              />
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="scroll-mt-24 py-20 md:py-28">
          <div className="mx-auto max-w-6xl px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
                Everything in one workspace
              </h2>
              <p className="mt-4 text-pretty text-muted-foreground md:text-lg">
                Built around the real workflow: shortlisting, contacting labs, refining
                narratives, and shipping materials before the clock runs out.
              </p>
            </div>

            <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <FeatureTile
                icon={Target}
                title="School pipeline"
                body="Track programs, statuses, and deadlines with reminders so rolling admissions don’t surprise you."
              />
              <FeatureTile
                icon={CalendarRange}
                title="Application timeline"
                body="See what’s coming across schools in one view — fewer spreadsheet tabs, fewer near-misses."
              />
              <FeatureTile
                icon={MessageSquareText}
                title="Professor email studio"
                body="Draft outreach and follow-ups with AI modes suited to academic tone — refine until you’re proud to send."
              />
              <FeatureTile
                icon={FileStack}
                title="Documents & versions"
                body="Upload SOPs, CVs, and supporting files with snapshots when you need to roll back a paragraph."
              />
              <FeatureTile
                icon={BookOpen}
                title="Writing & chat assistant"
                body="Grammar passes, structural suggestions, and feedback loops for statements and emails."
              />
              <FeatureTile
                icon={Zap}
                title="Optional Google hooks"
                body="Connect Gmail or Drive when you want your workflow closer to where files and threads already live."
              />
            </div>
          </div>
        </section>

        {/* How it works */}
        <section
          id="how"
          className="scroll-mt-24 border-t border-white/10 bg-black/15 py-20 md:py-28"
        >
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="text-center font-display text-3xl font-semibold tracking-tight md:text-4xl">
              How it works
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-center text-pretty text-muted-foreground md:text-lg">
              Three stages most applicants repeat until applications are in.
            </p>

            <ol className="mt-16 grid gap-10 md:grid-cols-3 md:gap-8">
              <Step
                step={1}
                title="Build your shortlist"
                description="Add schools, note requirements, and let deadlines surface on your dashboard and timeline."
              />
              <Step
                step={2}
                title="Draft with intention"
                description="Shape outreach and statements with AI help, then revise with versions and your own standards."
              />
              <Step
                step={3}
                title="Submit with confidence"
                description="Upload finals, track what’s sent, and keep momentum through rolling decisions."
              />
            </ol>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="scroll-mt-24 py-20 md:py-28">
          <div className="mx-auto max-w-6xl px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
                Pricing
              </h2>
              <p className="mt-4 text-pretty text-muted-foreground md:text-lg">
                Start free. Upgrade when you want higher monthly AI allowances and more
                room for drafts, discovery, and polish. Exact charges depend on how your
                deployment configures Stripe or Paystack.
              </p>
            </div>

            <div className="mt-14 grid gap-6 lg:grid-cols-3 lg:items-stretch">
              <PricingCard
                name="Free"
                price="$0"
                period=""
                description="Explore the workspace and stay organized."
                cta={{ href: "/register", label: "Create account" }}
                variant="default"
                bullets={[
                  `${aiFree} AI actions / month (included pool)`,
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
                  `Credit packs available (+${creditsPack} credits per pack where billing is set up)`,
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

            <p className="mx-auto mt-10 max-w-2xl text-center text-xs leading-relaxed text-muted-foreground">
              AI “actions” cover assistant work like drafts, chat turns, and discovery
              flows; bonus credits spend first. Dollar amounts are{" "}
              <strong className="font-medium text-foreground/90">examples</strong> only —
              your administrator sets real prices and providers. Without billing keys,
              limits may not be enforced.
            </p>
          </div>
        </section>

        {/* FAQ */}
        <section
          id="faq"
          className="scroll-mt-24 border-t border-white/10 bg-black/20 py-20 md:pb-28"
        >
          <div className="mx-auto max-w-3xl px-6">
            <h2 className="text-center font-display text-3xl font-semibold tracking-tight md:text-4xl">
              FAQ
            </h2>
            <div className="mt-12 space-y-3">
              <FaqItem
                question="Do I need a credit card to try GradApply?"
                answer="No. You can create an account and use the Free tier without payment. Paid tiers appear when your deployment enables billing (Stripe or Paystack)."
              />
              <FaqItem
                question="Will AI write my statement of purpose for me?"
                answer="GradApply is built so AI supports editing and structure — you stay the author. Use suggestions as a springboard, then revise until the story is unmistakably yours."
              />
              <FaqItem
                question="Can I use this without Google?"
                answer="Yes. Google connectors are optional. Core tracking, email drafting, documents, and assistant features work with email/password or other sign-in your host configures."
              />
            </div>
          </div>
        </section>

        {/* Footer CTA */}
        <section className="border-t border-white/10 py-16">
          <div className="mx-auto max-w-6xl px-6">
            <div className="glass-panel relative overflow-hidden px-8 py-12 text-center md:px-14 md:py-16">
              <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-primary/20 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-[hsl(275_70%_45%/0.18)] blur-3xl" />
              <div className="relative">
                <h2 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">
                  Ready to make this cycle feel manageable?
                </h2>
                <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
                  Start free, invite your focus back to programs and prose — not panic.
                </p>
                <div className="mt-8 flex flex-wrap justify-center gap-3">
                  <Link href="/register">
                    <Button size="lg">
                      Create your workspace
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                  <Link href="/login">
                    <Button size="lg" variant="glass">
                      Sign in
                    </Button>
                  </Link>
                </div>
              </div>
            </div>

            <footer className="mt-14 flex flex-col items-center justify-between gap-6 border-t border-white/10 pt-10 text-sm text-muted-foreground md:flex-row">
              <GlassBrandMark compact />
              <div className="flex flex-wrap justify-center gap-6">
                <a href="#features" className="hover:text-foreground">
                  Features
                </a>
                <a href="#pricing" className="hover:text-foreground">
                  Pricing
                </a>
                <Link href="/login" className="hover:text-foreground">
                  Sign in
                </Link>
                <Link href="/register" className="hover:text-foreground">
                  Register
                </Link>
              </div>
              <p className="text-xs">
                © {new Date().getFullYear()} GradApply
              </p>
            </footer>
          </div>
        </section>
      </main>
    </>
  );
}

function VisionCard(props: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  const Icon = props.icon;
  return (
    <div className="glass-panel p-8">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 ring-1 ring-primary/25">
        <Icon className="h-5 w-5 text-primary" aria-hidden />
      </div>
      <h3 className="mt-5 font-display text-lg font-semibold">{props.title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {props.description}
      </p>
    </div>
  );
}

function FeatureTile(props: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  const Icon = props.icon;
  return (
    <div className="glass-panel group p-6 transition-colors hover:border-primary/25">
      <Icon
        className="h-5 w-5 text-primary transition-transform group-hover:scale-105"
        aria-hidden
      />
      <h3 className="mt-4 font-display text-base font-semibold">{props.title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {props.body}
      </p>
    </div>
  );
}

function Step(props: { step: number; title: string; description: string }) {
  return (
    <li className="relative flex flex-col items-center text-center md:block md:text-left">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/15 font-display text-lg font-semibold text-primary ring-1 ring-primary/30">
        {props.step}
      </div>
      <h3 className="mt-5 font-display text-lg font-semibold">{props.title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {props.description}
      </p>
    </li>
  );
}

function PricingCard(props: {
  name: string;
  price: string;
  period: string;
  description: string;
  bullets: string[];
  cta: { href: string; label: string };
  variant: "default" | "highlight";
}) {
  const highlight = props.variant === "highlight";
  return (
    <div
      className={cn(
        "glass-panel flex flex-col p-8",
        highlight &&
          "border-primary/35 ring-2 ring-primary/25 shadow-[0_20px_60px_-12px_hsl(var(--primary)/0.35)]",
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-display text-xl font-semibold">{props.name}</h3>
        {highlight ? (
          <span className="glass-chip text-primary">Popular</span>
        ) : null}
      </div>
      <div className="mt-4 flex flex-wrap items-baseline gap-1.5">
        <span className="font-display text-4xl font-semibold tracking-tight">
          {props.price}
        </span>
        {props.period ? (
          <span className="text-sm text-muted-foreground">{props.period}</span>
        ) : null}
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{props.description}</p>
      <ul className="mt-8 flex-1 space-y-3 text-sm text-muted-foreground">
        {props.bullets.map((line) => (
          <li key={line} className="flex gap-2">
            <Check
              className="mt-0.5 h-4 w-4 shrink-0 text-primary"
              aria-hidden
            />
            <span>{line}</span>
          </li>
        ))}
      </ul>
      <Link href={props.cta.href} className="mt-10">
        <Button
          className="w-full"
          variant={highlight ? "default" : "secondary"}
          size="lg"
        >
          {props.cta.label}
        </Button>
      </Link>
    </div>
  );
}

function FaqItem(props: { question: string; answer: string }) {
  return (
    <details className="glass-panel group px-5 py-4 [&_summary::-webkit-details-marker]:hidden">
      <summary className="cursor-pointer list-none font-medium text-foreground">
        <span className="flex items-center justify-between gap-4">
          {props.question}
          <span className="text-muted-foreground transition group-open:rotate-180">
            ▾
          </span>
        </span>
      </summary>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        {props.answer}
      </p>
    </details>
  );
}
