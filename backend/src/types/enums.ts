/** Mirrors legacy `@prisma/client` enums for migrated handlers + zod `nativeEnum`. */

export const PlanTier = {
  FREE: "FREE",
  PLUS: "PLUS",
  PRO: "PRO",
} as const;
export type PlanTier = (typeof PlanTier)[keyof typeof PlanTier];

export const UserRole = {
  USER: "USER",
  ADMIN: "ADMIN",
  SUPERADMIN: "SUPERADMIN",
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const AccountAccessMode = {
  FULL: "FULL",
  READ_ONLY: "READ_ONLY",
} as const;
export type AccountAccessMode =
  (typeof AccountAccessMode)[keyof typeof AccountAccessMode];

export const BillingProvider = {
  STRIPE: "STRIPE",
  PAYSTACK: "PAYSTACK",
} as const;
export type BillingProvider =
  (typeof BillingProvider)[keyof typeof BillingProvider];

export const BillingPaymentKind = {
  PLAN_PURCHASE: "PLAN_PURCHASE",
  CREDITS_PACK: "CREDITS_PACK",
  CV_DEEP_REVIEW: "CV_DEEP_REVIEW",
  SOP_DETAILED_CRITIQUE: "SOP_DETAILED_CRITIQUE",
} as const;
export type BillingPaymentKind =
  (typeof BillingPaymentKind)[keyof typeof BillingPaymentKind];

export const ContentEntityType = {
  SOP: "SOP",
  CV: "CV",
  PROF_EMAIL: "PROF_EMAIL",
  OTHER: "OTHER",
} as const;
export type ContentEntityType =
  (typeof ContentEntityType)[keyof typeof ContentEntityType];

export const ConnectorProvider = {
  GMAIL: "GMAIL",
  GOOGLE_DRIVE: "GOOGLE_DRIVE",
} as const;
export type ConnectorProvider =
  (typeof ConnectorProvider)[keyof typeof ConnectorProvider];

export const SchoolStatus = {
  PLANNING: "PLANNING",
  APPLIED: "APPLIED",
  WAITING: "WAITING",
  ACCEPTED: "ACCEPTED",
  REJECTED: "REJECTED",
  WITHDRAWN: "WITHDRAWN",
} as const;
export type SchoolStatus =
  (typeof SchoolStatus)[keyof typeof SchoolStatus];

export const AdmissionTerm = {
  FALL: "FALL",
  SPRING: "SPRING",
  SUMMER: "SUMMER",
} as const;
export type AdmissionTerm =
  (typeof AdmissionTerm)[keyof typeof AdmissionTerm];

export const EmailStatus = {
  DRAFT: "DRAFT",
  SENT: "SENT",
  REPLIED: "REPLIED",
  NO_REPLY: "NO_REPLY",
  NOT_INTERESTED: "NOT_INTERESTED",
} as const;
export type EmailStatus =
  (typeof EmailStatus)[keyof typeof EmailStatus];

export const ReplyIntent = {
  INTERESTED: "INTERESTED",
  NEUTRAL: "NEUTRAL",
  DECLINED: "DECLINED",
  UNKNOWN: "UNKNOWN",
} as const;
export type ReplyIntent =
  (typeof ReplyIntent)[keyof typeof ReplyIntent];
