import { createId } from "@paralleldrive/cuid2";
import mongoose, { Schema } from "mongoose";

const idField = { type: String, default: createId };

const StripeEventLogSchema = new Schema(
  {
    _id: { type: String },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: "StripeEventLog" },
);

const PaystackEventLogSchema = new Schema(
  {
    _id: { type: String },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: "PaystackEventLog" },
);

const FeatureFlagSchema = new Schema(
  {
    _id: idField,
    key: { type: String, unique: true, required: true },
    name: { type: String, required: true },
    description: String,
    enabled: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { collection: "FeatureFlag" },
);

const AppSettingSchema = new Schema(
  {
    _id: { type: String },
    value: { type: String, required: true },
    isSecret: { type: Boolean, default: false },
    updatedAt: { type: Date, default: Date.now },
  },
  { collection: "AppSetting" },
);

const UserSchema = new Schema(
  {
    _id: idField,
    email: { type: String, unique: true, sparse: true },
    emailVerified: Date,
    name: String,
    image: String,
    passwordHash: String,
    createdAt: { type: Date, default: Date.now },
    role: {
      type: String,
      enum: ["USER", "ADMIN", "SUPERADMIN"],
      default: "USER",
    },
    planTier: {
      type: String,
      enum: ["FREE", "PLUS", "PRO"],
      default: "FREE",
    },
    stripeCustomerId: { type: String, unique: true, sparse: true },
    stripeSubscriptionId: String,
    stripePriceId: String,
    subscriptionStatus: String,
    currentPeriodEnd: Date,
    paystackCustomerId: { type: String, unique: true, sparse: true },
    paystackSubscriptionCode: String,
    aiUsageUsed: { type: Number, default: 0 },
    aiCreditsBalance: { type: Number, default: 0 },
    aiUsageMonth: String,
    freeEmailGenUsed: { type: Number, default: 0 },
    freeSopPreviewUsed: { type: Number, default: 0 },
    accessMode: {
      type: String,
      enum: ["FULL", "READ_ONLY"],
      default: "FULL",
    },
    accessReadOnlySince: Date,
  },
  { collection: "User" },
);

const BillingPaymentSchema = new Schema(
  {
    _id: idField,
    userId: { type: String, required: true, index: true },
    provider: { type: String, enum: ["STRIPE", "PAYSTACK"], required: true },
    providerReference: { type: String, required: true },
    kind: {
      type: String,
      enum: [
        "PLAN_PURCHASE",
        "CREDITS_PACK",
        "CV_DEEP_REVIEW",
        "SOP_DETAILED_CRITIQUE",
      ],
      required: true,
    },
    tier: { type: String, enum: ["FREE", "PLUS", "PRO"] },
    amountMinor: Number,
    currency: String,
    paidAt: { type: Date, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: "BillingPayment" },
);
BillingPaymentSchema.index(
  { provider: 1, providerReference: 1 },
  { unique: true },
);

const ContentVersionSchema = new Schema(
  {
    _id: idField,
    userId: { type: String, required: true, index: true },
    entityType: {
      type: String,
      enum: ["SOP", "CV", "PROF_EMAIL", "OTHER"],
      required: true,
    },
    entityId: String,
    label: { type: String, required: true },
    body: String,
    fileUrl: String,
    createdAt: { type: Date, default: Date.now },
    parentVersionId: { type: String, ref: "ContentVersion" },
  },
  { collection: "ContentVersion" },
);

const ConnectorSchema = new Schema(
  {
    _id: idField,
    userId: { type: String, required: true },
    provider: { type: String, enum: ["GMAIL", "GOOGLE_DRIVE"], required: true },
    externalEmail: String,
    refreshToken: { type: String, required: true },
    accessToken: String,
    accessExpiresAt: Date,
    scopes: String,
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { collection: "Connector" },
);
ConnectorSchema.index({ userId: 1, provider: 1 }, { unique: true });

const AccountSchema = new Schema(
  {
    _id: idField,
    userId: { type: String, required: true },
    type: String,
    provider: String,
    providerAccountId: String,
    refresh_token: String,
    access_token: String,
    expires_at: Number,
    token_type: String,
    scope: String,
    id_token: String,
    session_state: String,
  },
  { collection: "Account" },
);
AccountSchema.index({ provider: 1, providerAccountId: 1 }, { unique: true });

const SessionSchema = new Schema(
  {
    _id: idField,
    sessionToken: { type: String, unique: true, required: true },
    userId: { type: String, required: true },
    expires: { type: Date, required: true },
  },
  { collection: "Session" },
);

const VerificationTokenSchema = new Schema(
  {
    _id: idField,
    identifier: { type: String, required: true },
    token: { type: String, unique: true, required: true },
    expires: { type: Date, required: true },
  },
  { collection: "VerificationToken" },
);
VerificationTokenSchema.index({ identifier: 1, token: 1 }, { unique: true });

const ProfileSchema = new Schema(
  {
    _id: idField,
    userId: { type: String, unique: true, required: true },
    targetDegree: String,
    focusArea: String,
    greScore: String,
    greVerbal: Number,
    greQuant: Number,
    greAWA: Number,
    undergradSchool: String,
    undergradDegree: String,
    undergradGPA: Number,
    yearsExperience: String,
    researchInterests: String,
    countriesOfInterest: { type: [String], default: [] },
    bio: String,
    updatedAt: { type: Date, default: Date.now },
  },
  { collection: "Profile" },
);

const SchoolSchema = new Schema(
  {
    _id: idField,
    userId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    program: { type: String, required: true },
    degree: { type: String, required: true },
    country: String,
    term: { type: String, enum: ["FALL", "SPRING", "SUMMER"] },
    deadline: Date,
    status: {
      type: String,
      enum: [
        "PLANNING",
        "APPLIED",
        "WAITING",
        "ACCEPTED",
        "REJECTED",
        "WITHDRAWN",
      ],
      default: "PLANNING",
    },
    funding: String,
    notes: String,
    portalUrl: String,
    progress: { type: Number, default: 0 },
    reminderAt: Date,
    reminderNote: String,
    /** Optional async SOP review from Vercel AI Gateway + BullMQ (`backend/src/lib/ai`). */
    gatewaySopReview: {
      status: {
        type: String,
        enum: ["not_started", "queued", "processing", "done", "failed"],
        default: "not_started",
      },
      feedback: String,
      reviewedAt: Date,
      sopSnapshot: String,
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { collection: "School" },
);

const ProfEmailSchema = new Schema(
  {
    _id: idField,
    userId: { type: String, required: true, index: true },
    profName: String,
    profEmail: String,
    university: String,
    profileUrl: String,
    researchArea: String,
    emailSubject: String,
    emailBody: String,
    status: {
      type: String,
      enum: ["DRAFT", "SENT", "REPLIED", "NO_REPLY", "NOT_INTERESTED"],
      default: "DRAFT",
    },
    sentAt: Date,
    repliedAt: Date,
    lastReplySnippet: String,
    replyIntent: {
      type: String,
      enum: ["INTERESTED", "NEUTRAL", "DECLINED", "UNKNOWN"],
    },
    suggestedReplyDraft: String,
    replyRationale: String,
    lastClassifiedAt: Date,
    followUpCount: { type: Number, default: 0 },
    notes: String,
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { collection: "ProfEmail" },
);

const ChatMessageSchema = new Schema(
  {
    _id: idField,
    userId: { type: String, required: true, index: true },
    role: { type: String, required: true },
    content: { type: String, required: true },
    mode: String,
    schoolId: { type: String, index: true },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: "ChatMessage" },
);

const DocumentSchema = new Schema(
  {
    _id: idField,
    userId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    type: { type: String, required: true },
    url: { type: String, required: true },
    s3Key: String,
    mimeType: String,
    size: Number,
    folderId: { type: String, index: true },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: "Document" },
);

const FolderSchema = new Schema(
  {
    _id: idField,
    userId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    icon: String,
    color: String,
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { collection: "Folder" },
);
FolderSchema.index({ userId: 1, name: 1 }, { unique: true });

const SopVariantSchema = new Schema(
  {
    _id: idField,
    userId: { type: String, required: true, index: true },
    schoolId: { type: String, unique: true, required: true },
    title: { type: String, required: true },
    body: { type: String, required: true },
    sourceMasterId: String,
    masterText: String,
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { collection: "SopVariant" },
);

export const StripeEventLog =
  mongoose.models.StripeEventLog ||
  mongoose.model("StripeEventLog", StripeEventLogSchema);
export const PaystackEventLog =
  mongoose.models.PaystackEventLog ||
  mongoose.model("PaystackEventLog", PaystackEventLogSchema);
export const FeatureFlag =
  mongoose.models.FeatureFlag || mongoose.model("FeatureFlag", FeatureFlagSchema);
export const AppSetting =
  mongoose.models.AppSetting || mongoose.model("AppSetting", AppSettingSchema);
export const User =
  mongoose.models.User || mongoose.model("User", UserSchema);
export const BillingPayment =
  mongoose.models.BillingPayment ||
  mongoose.model("BillingPayment", BillingPaymentSchema);
export const ContentVersion =
  mongoose.models.ContentVersion ||
  mongoose.model("ContentVersion", ContentVersionSchema);
export const Connector =
  mongoose.models.Connector || mongoose.model("Connector", ConnectorSchema);
export const Account =
  mongoose.models.Account || mongoose.model("Account", AccountSchema);
export const Session =
  mongoose.models.Session || mongoose.model("Session", SessionSchema);
export const VerificationToken =
  mongoose.models.VerificationToken ||
  mongoose.model("VerificationToken", VerificationTokenSchema);
export const Profile =
  mongoose.models.Profile || mongoose.model("Profile", ProfileSchema);
export const School =
  mongoose.models.School || mongoose.model("School", SchoolSchema);
export const ProfEmail =
  mongoose.models.ProfEmail || mongoose.model("ProfEmail", ProfEmailSchema);
export const ChatMessage =
  mongoose.models.ChatMessage || mongoose.model("ChatMessage", ChatMessageSchema);
export const Document =
  mongoose.models.Document || mongoose.model("Document", DocumentSchema);
export const Folder =
  mongoose.models.Folder || mongoose.model("Folder", FolderSchema);
export const SopVariant =
  mongoose.models.SopVariant || mongoose.model("SopVariant", SopVariantSchema);
