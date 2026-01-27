// src/models/FundraisingPayout.ts
/**
 * Payout requests for fundraising campaigns.
 * Tracks requests for fund disbursement with approval workflow.
 */
import mongoose, { Schema, Types } from "mongoose";

// ============================================================================
// Types
// ============================================================================

export type PayoutStatus = "pending" | "approved" | "rejected" | "paid";

// ============================================================================
// Main Interface
// ============================================================================

export interface IFundraisingPayout {
  _id: Types.ObjectId;
  campaignId: Types.ObjectId;
  schoolId: Types.ObjectId;

  // Amount
  amountMinor: number;
  currency: string;

  // Status
  status: PayoutStatus;

  // Workflow
  requestedBy: Types.ObjectId;
  requestedAt: Date;
  approvedBy?: Types.ObjectId | null;
  approvedAt?: Date | null;
  rejectedBy?: Types.ObjectId | null;
  rejectedAt?: Date | null;
  paidAt?: Date | null;

  // Details
  notes?: string | null;
  rejectionReason?: string | null;
  paymentReference?: string | null;
  bankDetails?: {
    bankName?: string;
    accountNumber?: string;
    accountName?: string;
  } | null;

  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Schema
// ============================================================================

const FundraisingPayoutSchema = new Schema<IFundraisingPayout>(
  {
    campaignId: { type: Schema.Types.ObjectId, ref: "FundraisingCampaign", required: true, index: true },
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },

    // Amount
    amountMinor: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, default: "GHS" },

    // Status
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "paid"],
      default: "pending",
    },

    // Workflow
    requestedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    requestedAt: { type: Date, default: Date.now },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    approvedAt: { type: Date, default: null },
    rejectedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    rejectedAt: { type: Date, default: null },
    paidAt: { type: Date, default: null },

    // Details
    notes: { type: String, maxlength: 1000, default: null },
    rejectionReason: { type: String, maxlength: 500, default: null },
    paymentReference: { type: String, default: null },
    bankDetails: {
      type: new Schema(
        {
          bankName: { type: String },
          accountNumber: { type: String },
          accountName: { type: String },
        },
        { _id: false }
      ),
      default: null,
    },
  },
  { timestamps: true }
);

// ============================================================================
// Indexes
// ============================================================================

FundraisingPayoutSchema.index({ campaignId: 1, status: 1 });
FundraisingPayoutSchema.index({ schoolId: 1, status: 1 });
FundraisingPayoutSchema.index({ campaignId: 1, createdAt: -1 });

// ============================================================================
// Export Model
// ============================================================================

export const FundraisingPayout =
  (mongoose.models.FundraisingPayout as mongoose.Model<IFundraisingPayout>) ||
  mongoose.model<IFundraisingPayout>("FundraisingPayout", FundraisingPayoutSchema);
