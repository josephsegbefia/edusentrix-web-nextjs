// src/models/CommunityPollVote.ts
/**
 * Community poll votes - V2 structure.
 * One document per poll per voter, storing all answers in an array.
 * This fixes the mismatch where vote docs looked like "one per question" but uniqueness was "one per poll".
 */
import mongoose, { Schema, Types } from "mongoose";

// ============================================================================
// Types
// ============================================================================

export type VoterRole = "parent" | "student" | "teacher" | "staff";

// ============================================================================
// Answer Interface (embedded)
// ============================================================================

export interface IPollVoteAnswer {
  questionId: Types.ObjectId;
  optionIds?: Types.ObjectId[];      // For single/multi/ranked choice
  valueNumber?: number;               // For likert scale (1-5, etc.)
  valueBoolean?: boolean;             // For yes/no
  text?: string;                      // For comment type
  otherText?: string;                 // For "other" option text
}

// ============================================================================
// Main Interface
// ============================================================================

export interface ICommunityPollVote {
  _id: Types.ObjectId;
  pollId: Types.ObjectId;
  schoolId: Types.ObjectId;

  // All answers for this poll (one entry per question answered)
  answers: IPollVoteAnswer[];

  // Voter identity (optional if anonymous allowed)
  userId?: Types.ObjectId | null;
  role?: VoterRole;
  householdId?: Types.ObjectId | null;

  // Anti-abuse fields
  voterHash: string;                  // Hash of userId or householdId for uniqueness
  ipHash?: string | null;
  deviceFingerprint?: string | null;

  submittedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Schemas
// ============================================================================

const PollVoteAnswerSchema = new Schema<IPollVoteAnswer>(
  {
    questionId: { type: Schema.Types.ObjectId, required: true },
    optionIds: [{ type: Schema.Types.ObjectId }],
    valueNumber: { type: Number },
    valueBoolean: { type: Boolean },
    text: { type: String, maxlength: 2000 },
    otherText: { type: String, maxlength: 500 },
  },
  { _id: false }
);

const CommunityPollVoteSchema = new Schema<ICommunityPollVote>(
  {
    pollId: { type: Schema.Types.ObjectId, ref: "CommunityPoll", required: true, index: true },
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },

    // Answers array (one entry per question)
    answers: [PollVoteAnswerSchema],

    // Voter identity
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    role: {
      type: String,
      enum: ["parent", "student", "teacher", "staff"],
    },
    householdId: { type: Schema.Types.ObjectId, ref: "Guardian", default: null },

    // Anti-abuse
    voterHash: { type: String, required: true },
    ipHash: { type: String, default: null },
    deviceFingerprint: { type: String, default: null },

    submittedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// ============================================================================
// Indexes
// ============================================================================

// Query index for fetching votes by poll
CommunityPollVoteSchema.index({ pollId: 1, schoolId: 1, submittedAt: -1 });

// Unique constraint: one vote per poll per voter
CommunityPollVoteSchema.index({ pollId: 1, voterHash: 1 }, { unique: true });

// ============================================================================
// Export Model
// ============================================================================

export const CommunityPollVote =
  (mongoose.models.CommunityPollVote as mongoose.Model<ICommunityPollVote>) ||
  mongoose.model<ICommunityPollVote>("CommunityPollVote", CommunityPollVoteSchema);
