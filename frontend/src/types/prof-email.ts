import type { EmailStatus } from "@/types/enums";

/** Lean professor-email row shape used by outreach UI (replaces Prisma `ProfEmail`). */
export type ProfEmail = {
  id: string;
  profName?: string | null;
  profEmail?: string | null;
  university?: string | null;
  profileUrl?: string | null;
  researchArea?: string | null;
  emailSubject?: string | null;
  emailBody?: string | null;
  status: EmailStatus;
  notes?: string | null;
  sentAt?: Date | string | null;
  repliedAt?: Date | string | null;
  lastReplySnippet?: string | null;
  followUpCount?: number | null;
};
