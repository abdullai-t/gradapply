import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { GlassBrandMark, GlassScene } from "@/components/layout/glass-scene";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <GlassScene>
      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-6 py-8">
        <GlassBrandMark />
        <div className="flex items-center gap-2">
          <Link href="/login">
            <Button variant="glass" size="sm">
              Sign in
            </Button>
          </Link>
          <Link href="/login">
            <Button size="sm">
              Get started
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </header>

      <main className="relative mx-auto grid max-w-6xl gap-14 px-6 pb-28 pt-4 md:grid-cols-2 md:items-center md:pt-8">
        <div className="space-y-8">
          <span className="glass-badge border-primary/25 text-foreground/80">
            Built for busy applicants
          </span>
          <h1 className="font-display text-balance text-4xl font-semibold tracking-tight md:text-5xl md:leading-[1.08]">
            Your graduate school applications, organized.
          </h1>
          <p className="text-pretty text-lg leading-relaxed text-muted-foreground">
            Track deadlines and progress, draft thoughtful professor emails, upload
            documents to object storage, and lean on an LLM (OpenRouter or
            Anthropic) for grammar, SOP structure, and strategic feedback — all
            in one calm workspace.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/login">
              <Button size="lg" className="shadow-[0_12px_40px_-8px_hsl(var(--primary)/0.55)]">
                Start planning
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="glass">
                Sign in with Google
              </Button>
            </Link>
          </div>
        </div>

        <div className="glass-panel relative overflow-hidden p-8 md:p-10">
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/25 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-[hsl(275_70%_60%/0.2)] blur-3xl" />
          <div className="relative space-y-5 text-sm text-muted-foreground">
            <p className="text-base font-medium text-foreground">
              What you get in the MVP
            </p>
            <ul className="list-inside list-disc space-y-3 leading-relaxed">
              <li>School pipeline with deadlines and status</li>
              <li>Professor email drafting via OpenRouter or Anthropic</li>
              <li>Document uploads via Cloudinary (or S3 fallback)</li>
              <li>AI chat modes: grammar, SOP, email, feedback</li>
            </ul>
          </div>
        </div>
      </main>
    </GlassScene>
  );
}
