"use client";

import Link from "next/link";
import { Icon } from "@/components/icon";
import { cn } from "@/lib/utils";

type DocTone = "primary" | "tertiary" | "destructive" | "secondary";

const TONE: Record<
  DocTone,
  {
    iconBg: string;
    iconFg: string;
    pillBg: string;
    pillFg: string;
    pillBorder: string;
  }
> = {
  primary: {
    iconBg: "rgba(0,98,157,0.08)",
    iconFg: "var(--primary)",
    pillBg: "rgba(43,108,0,0.12)",
    pillFg: "var(--tertiary)",
    pillBorder: "rgba(43,108,0,0.3)",
  },
  destructive: {
    iconBg: "rgba(186,26,26,0.08)",
    iconFg: "var(--error)",
    pillBg: "rgba(186,26,26,0.12)",
    pillFg: "var(--error)",
    pillBorder: "rgba(186,26,26,0.3)",
  },
  tertiary: {
    iconBg: "rgba(43,108,0,0.08)",
    iconFg: "var(--tertiary)",
    pillBg: "var(--surface-container)",
    pillFg: "var(--on-surface-variant)",
    pillBorder: "var(--outline-variant)",
  },
  secondary: {
    iconBg: "rgba(83,250,194,0.18)",
    iconFg: "var(--on-secondary-container)",
    pillBg: "var(--secondary-container)",
    pillFg: "var(--on-secondary-container)",
    pillBorder: "rgba(43,108,0,0.3)",
  },
};

export interface DocStatus {
  icon: string;
  tone: DocTone;
  status: string;
  title: string;
  body: string;
  cta: string;
  ctaIcon: string;
  href: string;
  showBlinkDot?: boolean;
}

export function DocStatusGrid({ items }: { items: DocStatus[] }) {
  return (
    <section>
      <h2 className="t-headline-md m-0 mb-4 text-[var(--on-surface)]">
        Application Documents
      </h2>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {items.map((p, i) => (
          <div
            key={p.title}
            className="rise-in"
            style={{ animationDelay: `${0.5 + i * 0.08}s` }}
          >
            <DocStatusCard {...p} />
          </div>
        ))}
      </div>
    </section>
  );
}

function DocStatusCard({
  icon,
  tone,
  status,
  title,
  body,
  cta,
  ctaIcon,
  href,
  showBlinkDot,
}: DocStatus) {
  const t = TONE[tone];
  return (
    <Link
      href={href}
      className={cn(
        "doc-card tactile-card group block rounded-3xl border-2 p-6",
      )}
    >
      <div className="mb-5 flex items-center justify-between">
        <div
          className="doc-icon grid h-11 w-11 place-items-center rounded-xl transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-[1.08]"
          style={{ background: t.iconBg, color: t.iconFg }}
        >
          <Icon name={icon} size={26} />
        </div>
        <span
          className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.1em]"
          style={{
            background: t.pillBg,
            color: t.pillFg,
            borderColor: t.pillBorder,
          }}
        >
          {showBlinkDot ? (
            <span
              className="dot-blink h-1.5 w-1.5 rounded-full"
              style={{ background: t.pillFg }}
              aria-hidden
            />
          ) : null}
          {status}
        </span>
      </div>
      <h4 className="m-0 mb-1.5 text-lg font-bold text-[var(--on-surface)]">
        {title}
      </h4>
      <p className="m-0 mb-5 text-[13px] leading-[1.6] text-[var(--on-surface-variant)]">
        {body}
      </p>
      <div className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.1em] text-[var(--primary)]">
        {cta}
        <Icon
          name={ctaIcon}
          size={16}
          className="transition-transform duration-200 group-hover:translate-x-1"
        />
      </div>
    </Link>
  );
}
