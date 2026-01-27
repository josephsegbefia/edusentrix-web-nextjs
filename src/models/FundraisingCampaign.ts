// src/models/FundraisingCampaign.ts
/**
 * Fundraising campaigns for school projects, emergencies, PTA drives, etc.
 * V2: Includes publicShare, allowAnonymousDonations, and donorVisibility fields.
 */
import mongoose, { Schema, Types } from "mongoose";

// ============================================================================
// Types
// ============================================================================

export type CampaignStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "live"
  | "paused"
  | "closed"
  | "reconciled"
  | "archived";

export type CampaignApprovalStatus =
  | "not_required"
  | "pending"
  | "approved"
  | "rejected";

export type CampaignCategory =
  | "school_project"
  | "emergency"
  | "pta_drive"
  | "student_cause"
  | "other";

export type CampaignAudienceScope =
  | "school"
  | "grade"
  | "class"
  | "parents"
  | "staff";

export type CreatedByRole = "school_admin" | "teacher" | "staff";

export type DonorVisibility = "public_anonymous" | "public_named" | "admin_only";

export type SupportedCurrency = "GHS" | "USD" | "NGN" | "KES" | "ZAR" | "GBP" | "EUR";

// ============================================================================
// Embedded Subdocument Interfaces
// ============================================================================

export interface ICampaignSchedule {
  startDate?: Date | null;
  endDate?: Date | null;
  timezone?: string;
}

export interface ICampaignAudience {
  scope: CampaignAudienceScope;
  gradeIds?: Types.ObjectId[];
  classGroupIds?: Types.ObjectId[];
}

export interface ICampaignMilestone {
  _id: Types.ObjectId;
  label: string;
  amountMinor: number;
  reachedAt?: Date | null;
}

export interface ICampaignMatchingRule {
  _id: Types.ObjectId;
  matcherName: string;
  matchPercent: number;
  capMinor?: number;
}

export interface ICampaignPublicShare {
  enabled: boolean;
  token?: string | null;
  expiresAt?: Date | null;
}

// ============================================================================
// Main Interface
// ============================================================================

export interface IFundraisingCampaign {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;

  // Basic info
  title: string;
  summary?: string;
  description?: string;
  category: CampaignCategory;
  coverImageUrl?: string | null;
  galleryUrls?: string[];
  documents?: string[];
  tags?: string[];

  // Status & Workflow
  status: CampaignStatus;
  approvalStatus: CampaignApprovalStatus;
  approvalNotes?: string;
  approvedBy?: Types.ObjectId;
  approvedAt?: Date;

  // Creator
  createdBy: Types.ObjectId;
  createdByRole: CreatedByRole;

  // Schedule & Audience
  schedule: ICampaignSchedule;
  audience: ICampaignAudience;

  // Financial
  goalAmountMinor: number;
  currency: SupportedCurrency;
  raisedAmountMinor: number;
  donorCount: number;

  // Features
  milestones?: ICampaignMilestone[];
  matchingRules?: ICampaignMatchingRule[];
  isRecurringEnabled?: boolean;

  // V2: Public sharing
  publicShare: ICampaignPublicShare;
  allowAnonymousDonations: boolean;
  donorVisibility: DonorVisibility;

  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Schemas
// ============================================================================

const CampaignScheduleSchema = new Schema<ICampaignSchedule>(
  {
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    timezone: { type: String, default: "UTC" },
  },
  { _id: false }
);

const CampaignAudienceSchema = new Schema<ICampaignAudience>(
  {
    scope: {
      type: String,
      enum: ["school", "grade", "class", "parents", "staff"],
      required: true,
    },
    gradeIds: [{ type: Schema.Types.ObjectId, ref: "Grade" }],
    classGroupIds: [{ type: Schema.Types.ObjectId, ref: "ClassGroup" }],
  },
  { _id: false }
);

const CampaignMilestoneSchema = new Schema<ICampaignMilestone>(
  {
    label: { type: String, required: true },
    amountMinor: { type: Number, required: true },
    reachedAt: { type: Date, default: null },
  },
  { _id: true }
);

const CampaignMatchingRuleSchema = new Schema<ICampaignMatchingRule>(
  {
    matcherName: { type: String, required: true },
    matchPercent: { type: Number, required: true, min: 0, max: 100 },
    capMinor: { type: Number },
  },
  { _id: true }
);

const CampaignPublicShareSchema = new Schema<ICampaignPublicShare>(
  {
    enabled: { type: Boolean, default: false },
    token: { type: String, default: null },
    expiresAt: { type: Date, default: null },
  },
  { _id: false }
);

const FundraisingCampaignSchema = new Schema<IFundraisingCampaign>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },

    // Basic info
    title: { type: String, required: true, maxlength: 200 },
    summary: { type: String, maxlength: 500 },
    description: { type: String, maxlength: 5000 },
    category: {
      type: String,
      enum: ["school_project", "emergency", "pta_drive", "student_cause", "other"],
      default: "other",
    },
    coverImageUrl: { type: String, default: null },
    galleryUrls: [{ type: String }],
    documents: [{ type: String }],
    tags: [{ type: String }],

    // Status & Workflow
    status: {
      type: String,
      enum: ["draft", "pending_approval", "approved", "live", "paused", "closed", "reconciled", "archived"],
      default: "draft",
    },
    approvalStatus: {
      type: String,
      enum: ["not_required", "pending", "approved", "rejected"],
      default: "not_required",
    },
    approvalNotes: { type: String, maxlength: 1000 },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },

    // Creator
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    createdByRole: {
      type: String,
      enum: ["school_admin", "teacher", "staff"],
      required: true,
    },

    // Schedule & Audience
    schedule: { type: CampaignScheduleSchema, default: () => ({}) },
    audience: { type: CampaignAudienceSchema, required: true },

    // Financial
    goalAmountMinor: { type: Number, required: true, min: 0 },
    currency: {
      type: String,
      enum: ["GHS", "USD", "NGN", "KES", "ZAR", "GBP", "EUR"],
      default: "GHS",
    },
    raisedAmountMinor: { type: Number, default: 0 },
    donorCount: { type: Number, default: 0 },

    // Features
    milestones: [CampaignMilestoneSchema],
    matchingRules: [CampaignMatchingRuleSchema],
    isRecurringEnabled: { type: Boolean, default: false },

    // V2: Public sharing & visibility
    publicShare: { type: CampaignPublicShareSchema, default: () => ({ enabled: false }) },
    allowAnonymousDonations: { type: Boolean, default: true },
    donorVisibility: {
      type: String,
      enum: ["public_anonymous", "public_named", "admin_only"],
      default: "public_anonymous",
    },
  },
  { timestamps: true }
);

// ============================================================================
// Indexes
// ============================================================================

FundraisingCampaignSchema.index({ schoolId: 1, status: 1 });
FundraisingCampaignSchema.index({ schoolId: 1, createdAt: -1 });
FundraisingCampaignSchema.index({ schoolId: 1, category: 1 });
FundraisingCampaignSchema.index({ "publicShare.token": 1 }, { sparse: true });

// ============================================================================
// Export Model
// ============================================================================

export const FundraisingCampaign =
  (mongoose.models.FundraisingCampaign as mongoose.Model<IFundraisingCampaign>) ||
  mongoose.model<IFundraisingCampaign>("FundraisingCampaign", FundraisingCampaignSchema);
