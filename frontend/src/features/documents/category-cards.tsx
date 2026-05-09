"use client";

import { Icon } from "@/components/icon";

import type { DocRow } from "./documents-table";

/**
 * Bucket the document library by `DocumentKind` enum and render a 5-tile
 * grid that mirrors the design reference's "Categories" section.
 *
 * Buckets:
 *   - Academic   — sop_draft + transcript
 *   - Identity   — (no kind in v1; visual placeholder)
 *   - Test scores — gre
 *   - CV / refs  — cv
 *   - Other      — everything else
 *
 * Accepts EITHER a pre-loaded `docs` array (cheap, used when the page has
 * everything in memory) OR a `counts` object (used when paginated and the
 * caller fetched totals from `/api/documents/summary`). When both are
 * supplied, `counts` wins.
 */
export type CategoryCounts = {
  academic: number;
  identity: number;
  tests: number;
  cv: number;
  other: number;
};

export function bucketByKind(byKind: Record<string, number>): CategoryCounts {
  const get = (k: string) => byKind[k] ?? 0;
  return {
    academic: get("sop_draft") + get("transcript"),
    identity: get("identity"),
    tests: get("gre"),
    cv: get("cv"),
    other: Object.entries(byKind)
      .filter(
        ([k]) =>
          k !== "sop_draft" &&
          k !== "transcript" &&
          k !== "identity" &&
          k !== "gre" &&
          k !== "cv",
      )
      .reduce((sum, [, n]) => sum + n, 0),
  };
}

export function CategoryCards({
  docs,
  counts,
}: {
  docs?: DocRow[];
  counts?: CategoryCounts;
}) {
  const resolved: CategoryCounts =
    counts ??
    (docs
      ? {
          academic: docs.filter(
            (d) => d.type === "sop_draft" || d.type === "transcript",
          ).length,
          identity: docs.filter((d) => d.type === "identity").length,
          tests: docs.filter((d) => d.type === "gre").length,
          cv: docs.filter((d) => d.type === "cv").length,
          other: docs.filter(
            (d) =>
              d.type !== "sop_draft" &&
              d.type !== "transcript" &&
              d.type !== "identity" &&
              d.type !== "gre" &&
              d.type !== "cv",
          ).length,
        }
      : { academic: 0, identity: 0, tests: 0, cv: 0, other: 0 });

  return (
    <section>
      <h3 className="t-label-lg mb-3">Categories</h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <FolderCard
          icon="folder"
          title="Academic"
          count={resolved.academic}
          accent="var(--primary)"
        />
        <FolderCard
          icon="account_box"
          title="Identity"
          count={resolved.identity}
          accent="var(--secondary)"
        />
        <FolderCard
          icon="emoji_events"
          title="Test scores"
          count={resolved.tests}
          accent="var(--tertiary)"
        />
        <FolderCard
          icon="history_edu"
          title="CV / refs"
          count={resolved.cv}
          accent="var(--error)"
        />
        <FolderCard
          icon="folder_open"
          title="Other"
          count={resolved.other}
          accent="var(--outline)"
        />
      </div>
    </section>
  );
}

function FolderCard({
  icon,
  title,
  count,
  accent,
}: {
  icon: string;
  title: string;
  count: number;
  accent: string;
}) {
  return (
    <div
      className="rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-4 transition-all duration-200 hover:-translate-y-0.5 hover:bg-[var(--surface-container-low)]"
      style={{ borderBottom: `4px solid ${accent}` }}
    >
      <Icon
        name={icon}
        fill
        size={32}
        style={{ color: accent }}
        className="mb-3"
      />
      <h5 className="m-0 text-sm font-extrabold tracking-tight text-[var(--on-surface)]">
        {title}
      </h5>
      <p className="m-0 mt-0.5 text-[11px] text-[var(--on-surface-variant)]">
        {count} {count === 1 ? "file" : "files"}
      </p>
    </div>
  );
}
