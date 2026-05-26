import { cn } from "@/lib/utils";

import { EMAIL_STATUS_LABEL, type EmailStatus } from "./types";

const STATUS_TONE: Record<EmailStatus, string> = {
  DRAFT:
    "border-[var(--outline-variant)] bg-[var(--surface-container-high)] text-[var(--on-surface-variant)]",
  SENT: "border-primary/35 bg-primary/10 text-primary",
  REPLIED: "border-[var(--tertiary)]/40 bg-[var(--tertiary-container)] text-[var(--on-tertiary-container)]",
  NO_REPLY:
    "border-[var(--outline-variant)] bg-[var(--surface-container)] text-[var(--on-surface-variant)]",
  NOT_INTERESTED:
    "border-[var(--error)]/30 bg-[var(--error-container)] text-[var(--on-error-container)]",
};

type Props = {
  status: EmailStatus | string;
  className?: string;
};

export function ProfEmailStatusPill({ status, className }: Props) {
  const key = status as EmailStatus;
  const label =
    key in EMAIL_STATUS_LABEL
      ? EMAIL_STATUS_LABEL[key]
      : status.replaceAll("_", " ");

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide",
        STATUS_TONE[key] ?? STATUS_TONE.DRAFT,
        className,
      )}
    >
      {label}
    </span>
  );
}
