"use client";

import Link from "next/link";

import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { SealAvatar } from "@/components/seal-avatar";
import { CountUp } from "./count-up";

export interface RecSchool {
  id: string;
  name: string;
  program: string;
  /** Match score 0-100. */
  score: number;
  /** Tag tone — drives the small uppercase label color. */
  tone: "primary" | "secondary" | "tertiary";
  tag: string;
  /** Formatted deadline (e.g. "Dec 15"). */
  deadline: string;
}

const TONE_COLOR: Record<RecSchool["tone"], string> = {
  primary: "var(--primary)",
  secondary: "var(--secondary)",
  tertiary: "var(--tertiary)",
};

export function RecSchoolGrid({ items }: { items: RecSchool[] }) {
  if (items.length === 0) {
    return (
      <section className="mt-12">
        <div
          className="rise-in mb-5 flex items-center justify-between"
          style={{ animationDelay: "0.7s" }}
        >
          <h2 className="t-headline-lg m-0">Recommended Schools</h2>
          <Button asChild variant="ghost" size="sm">
            <Link href="/schools">Open Schools</Link>
          </Button>
        </div>
        <div className="rounded-3xl border-2 border-dashed border-[var(--outline-variant)] p-12 text-center">
          <Icon
            name="add_business"
            size={36}
            className="text-[var(--outline)]"
          />
          <p className="mt-3 text-sm text-[var(--on-surface-variant)]">
            Add schools to get personalized recommendations.
          </p>
          <Button asChild className="mt-4" icon="add">
            <Link href="/schools">Add a school</Link>
          </Button>
        </div>
      </section>
    );
  }
  return (
    <section className="mt-12">
      <div
        className="rise-in mb-5 flex items-center justify-between"
        style={{ animationDelay: "0.7s" }}
      >
        <h2 className="t-headline-lg m-0">Recommended Schools</h2>
        <Button asChild variant="ghost" size="sm">
          <Link href="/schools">View all schools</Link>
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {items.map((p, i) => (
          <div
            key={p.id}
            className="rise-in"
            style={{ animationDelay: `${0.75 + i * 0.08}s` }}
          >
            <RecSchoolCard {...p} />
          </div>
        ))}
      </div>
    </section>
  );
}

function RecSchoolCard({ id, name, program, score, tone, tag, deadline }: RecSchool) {
  const tagColor = TONE_COLOR[tone];
  return (
    <div className="tactile-card school-card group rounded-3xl border-2 border-[var(--outline-variant)] p-6">
      <div className="mb-5 flex items-start justify-between">
        <div className="transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-[1.06]">
          <SealAvatar name={name} size={52} />
        </div>
        <div className="text-right">
          <div
            className="mb-0.5 text-[9px] font-extrabold uppercase tracking-[0.15em]"
            style={{ color: tagColor }}
          >
            {tag}
          </div>
          <div className="text-[1.75rem] font-extrabold tracking-tight text-[var(--on-surface)]">
            <CountUp to={score} suffix="%" duration={1200} delay={500} />
          </div>
        </div>
      </div>
      <div className="mb-6">
        <h4 className="m-0 mb-1 text-xl font-bold text-[var(--on-surface)]">
          {name}
        </h4>
        <div className="t-label-lg">{program}</div>
      </div>
      <div className="flex items-center justify-between border-t-2 border-[var(--surface-container)] pt-5">
        <div className="flex items-center gap-1.5 text-[var(--outline)]">
          <Icon name="calendar_today" size={16} />
          <span className="t-label-lg">{deadline}</span>
        </div>
        <Button asChild size="sm">
          <Link href={`/schools/${id}`}>Open</Link>
        </Button>
      </div>
    </div>
  );
}
