"use client";

import Link from "next/link";
import { format } from "date-fns";

import { Icon } from "@/components/icon";
import { formatBytes } from "@/lib/utils";
import { DOCUMENT_KIND_LABEL } from "@/components/add-document-modal";

import type { DocRow } from "./documents-table";

const KIND_TONE: Record<
  string,
  { tint: string; fg: string; icon: string }
> = {
  cv: {
    tint: "rgba(0,98,157,0.08)",
    fg: "var(--primary)",
    icon: "description",
  },
  sop_draft: {
    tint: "rgba(43,108,0,0.08)",
    fg: "var(--tertiary)",
    icon: "edit_note",
  },
  transcript: {
    tint: "rgba(186,26,26,0.08)",
    fg: "var(--error)",
    icon: "school",
  },
  gre: {
    tint: "rgba(83,250,194,0.18)",
    fg: "var(--on-secondary-container)",
    icon: "calculate",
  },
  other: {
    tint: "var(--surface-container-high)",
    fg: "var(--on-surface-variant)",
    icon: "draft",
  },
};

/**
 * QuickAccess — surfaces the 2 most recent documents as tactile tiles.
 * Pure derivation from the loaded list (no extra fetch).
 */
export function QuickAccess({ docs }: { docs: DocRow[] }) {
  const recent = [...docs]
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .slice(0, 2);

  if (recent.length === 0) return null;

  return (
    <section>
      <h3 className="t-label-lg mb-3 flex items-center justify-between">
        <span>Quick access</span>
        {docs.length > 2 ? (
          <span className="text-[10px] font-bold normal-case tracking-normal text-[var(--on-surface-variant)]">
            Showing 2 of {docs.length}
          </span>
        ) : null}
      </h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {recent.map((doc) => (
          <QuickAccessTile key={doc.id} doc={doc} />
        ))}
      </div>
    </section>
  );
}

function QuickAccessTile({ doc }: { doc: DocRow }) {
  const tone = KIND_TONE[doc.type] ?? KIND_TONE.other!;
  const label =
    DOCUMENT_KIND_LABEL[doc.type as keyof typeof DOCUMENT_KIND_LABEL] ??
    doc.type.replaceAll("_", " ");

  return (
    <Link
      href={doc.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-3.5 rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--primary)] hover:[box-shadow:0_4px_0_0_var(--outline-variant)]"
    >
      <div
        className="grid h-12 w-12 shrink-0 place-items-center rounded-xl"
        style={{ background: tone.tint, color: tone.fg }}
      >
        <Icon name={tone.icon} size={24} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="m-0 truncate text-sm font-bold text-[var(--on-surface)]">
          {doc.name}
        </p>
        <p className="m-0 mt-0.5 text-xs text-[var(--on-surface-variant)]">
          {label} ·{" "}
          {doc.size != null ? `${formatBytes(doc.size)} · ` : ""}
          {format(new Date(doc.createdAt), "MMM d")}
        </p>
      </div>
      <Icon
        name="open_in_new"
        size={18}
        className="text-[var(--outline)] transition-colors group-hover:text-[var(--primary)]"
      />
    </Link>
  );
}
