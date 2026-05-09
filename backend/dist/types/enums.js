/** Mirrors legacy `@prisma/client` enums for migrated handlers + zod `nativeEnum`. */
export const PlanTier = {
    FREE: "FREE",
    PLUS: "PLUS",
    PRO: "PRO",
};
export const UserRole = {
    USER: "USER",
    ADMIN: "ADMIN",
    SUPERADMIN: "SUPERADMIN",
};
export const AccountAccessMode = {
    FULL: "FULL",
    READ_ONLY: "READ_ONLY",
};
export const BillingProvider = {
    STRIPE: "STRIPE",
    PAYSTACK: "PAYSTACK",
};
export const BillingPaymentKind = {
    PLAN_PURCHASE: "PLAN_PURCHASE",
    CREDITS_PACK: "CREDITS_PACK",
    CV_DEEP_REVIEW: "CV_DEEP_REVIEW",
    SOP_DETAILED_CRITIQUE: "SOP_DETAILED_CRITIQUE",
};
export const ContentEntityType = {
    SOP: "SOP",
    CV: "CV",
    PROF_EMAIL: "PROF_EMAIL",
    OTHER: "OTHER",
};
export const ConnectorProvider = {
    GMAIL: "GMAIL",
    GOOGLE_DRIVE: "GOOGLE_DRIVE",
};
export const SchoolStatus = {
    PLANNING: "PLANNING",
    APPLIED: "APPLIED",
    WAITING: "WAITING",
    ACCEPTED: "ACCEPTED",
    REJECTED: "REJECTED",
    WITHDRAWN: "WITHDRAWN",
};
export const AdmissionTerm = {
    FALL: "FALL",
    SPRING: "SPRING",
    SUMMER: "SUMMER",
};
export const EmailStatus = {
    DRAFT: "DRAFT",
    SENT: "SENT",
    REPLIED: "REPLIED",
    NO_REPLY: "NO_REPLY",
    NOT_INTERESTED: "NOT_INTERESTED",
};
export const ReplyIntent = {
    INTERESTED: "INTERESTED",
    NEUTRAL: "NEUTRAL",
    DECLINED: "DECLINED",
    UNKNOWN: "UNKNOWN",
};
