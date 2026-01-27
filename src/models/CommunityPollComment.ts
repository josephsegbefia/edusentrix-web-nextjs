// src/models/CommunityPollComment.ts
/**
 * Optional moderated comments on community polls.
 * Comments require admin approval before being visible.
 */
import mongoose, { Schema, Types } from "mongoose";

// ============================================================================
// Types
// ============================================================================

export type CommentStatus = "pending" | "approved" | "rejected";

// ============================================================================
// Main Interface
// ============================================================================

export interface ICommunityPollComment {
  _id: Types.ObjectId;
  pollId: Types.ObjectId;
  schoolId: Types.ObjectId;

  // Author
  userId?: Types.ObjectId | null;
  isAnonymous: boolean;

  // Content
  message: string;

  // Moderation
  status: CommentStatus;
  moderatedBy?: Types.ObjectId | null;
  moderatedAt?: Date | null;
  moderationNote?: string | null;

  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Schema
// ============================================================================

const CommunityPollCommentSchema = new Schema<ICommunityPollComment>(
  {
    pollId: { type: Schema.Types.ObjectId, ref: "CommunityPoll", required: true, index: true },
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },

    // Author
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    isAnonymous: { type: Boolean, default: false },

    // Content
    message: { type: String, required: true, maxlength: 2000 },

    // Moderation
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    moderatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    moderatedAt: { type: Date, default: null },
    moderationNote: { type: String, maxlength: 500, default: null },
  },
  { timestamps: true }
);

// ============================================================================
// Indexes
// ============================================================================

CommunityPollCommentSchema.index({ pollId: 1, status: 1 });
CommunityPollCommentSchema.index({ pollId: 1, createdAt: -1 });
CommunityPollCommentSchema.index({ schoolId: 1, status: 1 });

// ============================================================================
// Export Model
// ============================================================================

export const CommunityPollComment =
  (mongoose.models.CommunityPollComment as mongoose.Model<ICommunityPollComment>) ||
  mongoose.model<ICommunityPollComment>("CommunityPollComment", CommunityPollCommentSchema);
