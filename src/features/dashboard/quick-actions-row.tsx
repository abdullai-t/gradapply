import Link from "next/link";

import { Icon } from "@/components/icon";

const ACTIONS = [
  { icon: "add", label: "Add school", href: "/schools" },
  { icon: "upload_file", label: "Upload doc", href: "/documents" },
  { icon: "edit_note", label: "SOP studio", href: "/assistant?mode=sop" },
] as const;

export function QuickActionsRow({ className }: { className?: string }) {
  return (
    <div
      className={`flex flex-wrap gap-2 ${className ?? ""}`.trim()}
    >
      {ACTIONS.map((a) => (
        <Link
          key={a.href}
          href={a.href}
          className="inline-flex items-center gap-2 rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-4 py-2.5 text-sm font-bold text-[var(--on-surface)] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-container)]"
        >
          <Icon name={a.icon} size={18} className="text-[var(--primary)]" />
          {a.label}
        </Link>
      ))}
    </div>
  );
}
