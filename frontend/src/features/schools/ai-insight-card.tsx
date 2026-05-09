"use client";

import Link from "next/link";

import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import type { SchoolRow } from "./types";

/**
 * AI insight panel at the bottom of the schools grid. Derives a short
 * narrative from the user's actual school list — no fetch.
 *
 *   - 0 schools           → encourage to add the first
 *   - schools with no SOP → suggest tailoring next
 *   - acceptances present → celebrate
 *   - upcoming deadline   → focus message on the nearest one
 *   - default             → "stay calm, keep moving"
 */
export function AIInsightCard({ schools }: { schools: SchoolRow[] }) {
  const insight = pickInsight(schools);

  return (
    <div
      className="relative mt-12 overflow-hidden rounded-3xl border border-[var(--outline-variant)] p-7 md:p-8"
      style={{
        background:
          "linear-gradient(135deg, color-mix(in srgb, var(--surface-container-lowest) 70%, transparent), color-mix(in srgb, var(--surface-container-lowest) 40%, transparent))",
        backdropFilter: "blur(12px)",
        boxShadow: "0 20px 60px -20px rgba(0, 98, 157, 0.15)",
      }}
    >
      <div
        className="float-blob pointer-events-none absolute -right-24 -top-24 h-60 w-60 rounded-full"
        style={{
          background: "rgba(0,163,255,0.18)",
          filter: "blur(80px)",
        }}
        aria-hidden
      />
      <div
        className="float-blob pointer-events-none absolute -bottom-16 -left-12 h-48 w-48 rounded-full"
        style={{
          background: "rgba(43,108,0,0.12)",
          filter: "blur(70px)",
          animationDelay: "1.5s",
        }}
        aria-hidden
      />

      <div className="relative flex flex-col items-start gap-6 md:flex-row md:items-center">
        <div
          className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl text-white"
          style={{
            background:
              "linear-gradient(135deg, var(--primary-container), var(--primary))",
            boxShadow: "0 10px 24px rgba(0, 98, 157, 0.3)",
          }}
        >
          <Icon name="auto_awesome" fill size={32} />
        </div>
        <div className="flex-1">
          <h4 className="t-headline-md m-0 text-[var(--on-surface)]">
            {insight.headline}
          </h4>
          <p
            className="mt-2 text-[15px] leading-relaxed text-[var(--on-surface-variant)]"
            // safe: insight.body is built from a static template + numbers/names
            // we emit ourselves, never user-supplied HTML.
            dangerouslySetInnerHTML={{ __html: insight.body }}
          />
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild variant="secondary" size="sm">
              <Link href={insight.primary.href}>{insight.primary.label}</Link>
            </Button>
            {insight.secondary ? (
              <Button asChild variant="ghost" size="sm" iconRight="arrow_forward">
                <Link href={insight.secondary.href}>
                  {insight.secondary.label}
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function pickInsight(schools: SchoolRow[]): {
  headline: string;
  body: string;
  primary: { label: string; href: string };
  secondary?: { label: string; href: string };
} {
  if (schools.length === 0) {
    return {
      headline: "Build your shortlist",
      body: "Add three schools you're considering — your dossier becomes useful the moment your list does.",
      primary: { label: "Add schools", href: "/schools" },
    };
  }

  const accepted = schools.filter((s) => s.status === "ACCEPTED");
  if (accepted.length > 0) {
    return {
      headline: `${accepted.length} acceptance${accepted.length === 1 ? "" : "s"} — well done.`,
      body: "Keep momentum on the rest of your list and tailor outreach for any waiting decisions.",
      primary: { label: "Open Outreach", href: "/emails" },
      secondary: { label: "View timeline", href: "/timeline" },
    };
  }

  const withDeadline = schools.filter(
    (s) =>
      s.deadline &&
      (s.status === "PLANNING" ||
        s.status === "APPLIED" ||
        s.status === "WAITING"),
  );
  if (withDeadline.length > 0) {
    const next = withDeadline.reduce((min, s) =>
      new Date(s.deadline!).getTime() < new Date(min.deadline!).getTime()
        ? s
        : min,
    );
    const days = Math.max(
      0,
      Math.ceil(
        (new Date(next.deadline!).getTime() - Date.now()) /
          (1000 * 60 * 60 * 24),
      ),
    );
    return {
      headline: "Focus your week",
      body: `Your next deadline is <strong>${escapeHtml(next.name)}</strong> in <strong>${days} day${days === 1 ? "" : "s"}</strong>. Tailor your SOP and tighten one paragraph today.`,
      primary: {
        label: "Open SOP studio",
        href: `/assistant?mode=sop&schoolId=${next.id}`,
      },
      secondary: { label: "View timeline", href: "/timeline" },
    };
  }

  return {
    headline: "Stay calm, keep moving",
    body: `You have <strong>${schools.length}</strong> school${schools.length === 1 ? "" : "s"} on file. Add a deadline to surface it on the timeline.`,
    primary: { label: "Open timeline", href: "/timeline" },
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
