// src/models/CommunityPoll.ts
/**
 * Community polls for school-wide or class-limited voting.
 * Supports multiple question types: single choice, multi choice, ranked choice, likert, yes/no, comment.
 */
import mongoose, { Schema, Types } from "mongoose";

// ============================================================================
// Types
// ============================================================================

export type PollStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "live"
  | "closed"
  | "archived";

export type ApprovalStatus =
  | "not_required"
  | "pending"
  | "approved"
  | "rejected";

export type PollQuestionType =
  | "single_choice"
  | "multi_choice"
  | "ranked_choice"
  | "likert"
  | "yes_no"
  | "comment";

export type AudienceScope =
  | "school"
  | "grade"
  | "class"
  | "staff"
  | "parents"
  | "students";

export type RevealResults = "live" | "after_close" | "admin_only";

export type CreatedByRole = "school_admin" | "teacher" | "staff";

// ============================================================================
// Embedded Subdocument Interfaces
// ============================================================================

export interface IPollOption {
  _id: Types.ObjectId;
  label: string;
  imageUrl?: string | null;
  order: number;
}

export interface IPollQuestion {
  _id: Types.ObjectId;
  prompt: string;
  type: PollQuestionType;
  options?: IPollOption[];
  required?: boolean;
  allowOther?: boolean;
  order: number;
}

export interface IPollSchedule {
  startDate?: Date | null;
  endDate?: Date | null;
  timezone?: string;
}

export interface IPollAudience {
  scope: AudienceScope;
  gradeIds?: Types.ObjectId[];
  classGroupIds?: Types.ObjectId[];
  roles?: string[];
}

// ============================================================================
// Main Interface
// ============================================================================

export interface ICommunityPoll {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;

  // Basic info
  title: string;
  description?: string;
  coverImageUrl?: string | null;
  tags?: string[];

  // Status & Workflow
  status: PollStatus;
  approvalStatus: ApprovalStatus;
  approvalNotes?: string;
  approvedBy?: Types.ObjectId;
  approvedAt?: Date;

  // Creator
  createdBy: Types.ObjectId;
  createdByRole: CreatedByRole;

  // Schedule & Audience
  schedule: IPollSchedule;
  audience: IPollAudience;

  // Questions (embedded)
  questions: IPollQuestion[];

  // Settings
  allowAnonymous: boolean;
  allowComments: boolean;
  revealResults: RevealResults;

  // Stats (denormalized for performance)
  totalVotes?: number;
  eligibleCount?: number;
  participationRate?: number;

  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Schemas
// ============================================================================

const PollOptionSchema = new Schema<IPollOption>(
  {
    label: { type: String, required: true },
    imageUrl: { type: String, default: null },
    order: { type: Number, default: 0 },
  },
  { _id: true }
);

const PollQuestionSchema = new Schema<IPollQuestion>(
  {
    prompt: { type: String, required: true },
    type: {
      type: String,
      enum: ["single_choice", "multi_choice", "ranked_choice", "likert", "yes_no", "comment"],
      required: true,
    },
    options: [PollOptionSchema],
    required: { type: Boolean, default: true },
    allowOther: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
  },
  { _id: true }
);

const PollScheduleSchema = new Schema<IPollSchedule>(
  {
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    timezone: { type: String, default: "UTC" },
  },
  { _id: false }
);

const PollAudienceSchema = new Schema<IPollAudience>(
  {
    scope: {
      type: String,
      enum: ["school", "grade", "class", "staff", "parents", "students"],
      required: true,
    },
    gradeIds: [{ type: Schema.Types.ObjectId, ref: "Grade" }],
    classGroupIds: [{ type: Schema.Types.ObjectId, ref: "ClassGroup" }],
    roles: [{ type: String }],
  },
  { _id: false }
);

const CommunityPollSchema = new Schema<ICommunityPoll>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },

    // Basic info
    title: { type: String, required: true, maxlength: 200 },
    description: { type: String, maxlength: 2000 },
    coverImageUrl: { type: String, default: null },
    tags: [{ type: String }],

    // Status & Workflow
    status: {
      type: String,
      enum: ["draft", "pending_approval", "approved", "live", "closed", "archived"],
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
    schedule: { type: PollScheduleSchema, default: () => ({}) },
    audience: { type: PollAudienceSchema, required: true },

    // Questions
    questions: [PollQuestionSchema],

    // Settings
    allowAnonymous: { type: Boolean, default: false },
    allowComments: { type: Boolean, default: false },
    revealResults: {
      type: String,
      enum: ["live", "after_close", "admin_only"],
      default: "after_close",
    },

    // Stats
    totalVotes: { type: Number, default: 0 },
    eligibleCount: { type: Number, default: 0 },
    participationRate: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// ============================================================================
// Indexes
// ============================================================================

CommunityPollSchema.index({ schoolId: 1, status: 1 });
CommunityPollSchema.index({ schoolId: 1, createdAt: -1 });
CommunityPollSchema.index({ schoolId: 1, "audience.scope": 1 });
CommunityPollSchema.index({ schoolId: 1, createdBy: 1 });

// ============================================================================
// Export Model
// ============================================================================

export const CommunityPoll =
  (mongoose.models.CommunityPoll as mongoose.Model<ICommunityPoll>) ||
  mongoose.model<ICommunityPoll>("CommunityPoll", CommunityPollSchema);
