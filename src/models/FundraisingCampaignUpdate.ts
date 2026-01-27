// src/models/FundraisingCampaignUpdate.ts
/**
 * Progress updates posted to fundraising campaigns.
 * Keeps donors and supporters informed about campaign progress.
 */
import mongoose, { Schema, Types } from "mongoose";

// ============================================================================
// Main Interface
// ============================================================================

export interface IFundraisingCampaignUpdate {
  _id: Types.ObjectId;
  campaignId: Types.ObjectId;
  schoolId: Types.ObjectId;

  // Author
  createdBy: Types.ObjectId;

  // Content
  title: string;
  body: string;
  attachments?: string[];

  // Visibility
  isPublished: boolean;
  publishedAt?: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Schema
// ============================================================================

const FundraisingCampaignUpdateSchema = new Schema<IFundraisingCampaignUpdate>(
  {
    campaignId: { type: Schema.Types.ObjectId, ref: "FundraisingCampaign", required: true, index: true },
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },

    // Author
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },

    // Content
    title: { type: String, required: true, maxlength: 200 },
    body: { type: String, required: true, maxlength: 5000 },
    attachments: [{ type: String }],

    // Visibility
    isPublished: { type: Boolean, default: true },
    publishedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// ============================================================================
// Indexes
// ============================================================================

FundraisingCampaignUpdateSchema.index({ campaignId: 1, createdAt: -1 });
FundraisingCampaignUpdateSchema.index({ campaignId: 1, isPublished: 1 });

// ============================================================================
// Export Model
// ============================================================================

export const FundraisingCampaignUpdate =
  (mongoose.models.FundraisingCampaignUpdate as mongoose.Model<IFundraisingCampaignUpdate>) ||
  mongoose.model<IFundraisingCampaignUpdate>("FundraisingCampaignUpdate", FundraisingCampaignUpdateSchema);
