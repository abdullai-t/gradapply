export type EmailStatus =
  | "DRAFT"
  | "SENT"
  | "REPLIED"
  | "NO_REPLY"
  | "NOT_INTERESTED";

export type ReplyIntentKind =
  | "INTERESTED"
  | "NEUTRAL"
  | "DECLINED"
  | "UNKNOWN";

export type ResearchAuditStored = {
  latestResearch: Array<{
    title: string;
    year: string | null;
    summary: string;
    evidence: string | null;
  }>;
  sourceUrl: string;
  auditedAt: string;
};

export type EmailRow = {
  id: string;
  profName: string | null;
  profEmail: string | null;
  university: string | null;
  profileUrl: string | null;
  researchArea: string | null;
  matchScore: number | null;
  emailSubject: string | null;
  emailBody: string | null;
  status: EmailStatus;
  notes: string | null;
  lastReplySnippet?: string | null;
  replyIntent?: ReplyIntentKind | null;
  suggestedReplyDraft?: string | null;
  replyRationale?: string | null;
  lastClassifiedAt?: string | null;
  updatedAt?: string | null;
  researchAudit?: ResearchAuditStored | null;
};

export const EMAIL_STATUSES: EmailStatus[] = [
  "DRAFT",
  "SENT",
  "REPLIED",
  "NO_REPLY",
  "NOT_INTERESTED",
];

export const EMAIL_STATUS_LABEL: Record<EmailStatus, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  REPLIED: "Replied",
  NO_REPLY: "No reply",
  NOT_INTERESTED: "Not interested",
};

export type DiscoveryCand = {
  name: string;
  profileUrl: string | null;
  profEmail: string | null;
  researchArea: string | null;
  schoolId: string | null;
  targetSchoolLabel: string | null;
  matchScore: number;
  rationale: string;
  source: "page_link" | "page_text" | "school_program";
};

export type SchoolPick = {
  id: string;
  name: string;
  program: string;
  degree: string;
};
