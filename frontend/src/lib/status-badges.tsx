import type { ComponentProps } from "react";
import type { EmailStatus, SchoolStatus } from "@/types/enums";

import { Badge } from "@/components/ui/badge";

const schoolVariant: Record<
  SchoolStatus,
  NonNullable<ComponentProps<typeof Badge>["variant"]>
> = {
  PLANNING: "muted",
  APPLIED: "secondary",
  WAITING: "warning",
  ACCEPTED: "success",
  REJECTED: "destructive",
  WITHDRAWN: "outline",
};

const emailVariant: Record<
  EmailStatus,
  NonNullable<ComponentProps<typeof Badge>["variant"]>
> = {
  DRAFT: "muted",
  SENT: "secondary",
  REPLIED: "success",
  NO_REPLY: "warning",
  NOT_INTERESTED: "destructive",
};

const schoolLabel: Record<SchoolStatus, string> = {
  PLANNING: "Planning",
  APPLIED: "Applied",
  WAITING: "Waiting",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
};

const emailLabel: Record<EmailStatus, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  REPLIED: "Replied",
  NO_REPLY: "No Reply",
  NOT_INTERESTED: "Not interested",
};

export function SchoolStatusBadge({ status }: { status: SchoolStatus }) {
  return <Badge variant={schoolVariant[status]}>{schoolLabel[status]}</Badge>;
}

export function EmailStatusBadge({ status }: { status: EmailStatus }) {
  return <Badge variant={emailVariant[status]}>{emailLabel[status]}</Badge>;
}
