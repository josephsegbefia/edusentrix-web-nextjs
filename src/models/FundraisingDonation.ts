// src/models/FundraisingDonation.ts
/**
 * Individual donations to fundraising campaigns.
 * V2: Includes idempotency fields for webhook safety.
 */
import mongoose, { Schema, Types } from "mongoose";

// ============================================================================
// Types
// ============================================================================

export type DonationStatus = "pending" | "completed" | "failed" | "refunded";

export type PaymentMethod =
  | "cash"
  | "bank_transfer"
  | "mobile_money"
  | "paystack"
  | "stripe"
  | "cheque"
  | "other";

// ============================================================================
// Main Interface
// ============================================================================

export interface IFundraisingDonation {
  _id: Types.ObjectId;
  campaignId: Types.ObjectId;
  schoolId: Types.ObjectId;

  // Amount
  amountMinor: number;
  currency: string;

  // Status
  status: DonationStatus;

  // Donor info
  donorUserId?: Types.ObjectId | null;
  donorName?: string | null;
  donorEmail?: string | null;
  donorPhone?: string | null;
  isAnonymous: boolean;
  message?: string | null;

  // Payment
  paymentMethod: PaymentMethod;

  // V2: Idempotency fields for webhook safety
  idempotencyKey?: string | null;
  intentId?: string | null;
  gatewayReference?: string | null;
  gatewayTransactionId?: string | null;
  gatewayEventId?: string | null;
  gatewayResponse?: Record<string, unknown> | null;

  // Receipt
  receiptNumber?: string | null;

  // Refund
  refundedAt?: Date | null;
  refundReason?: string | null;

  // Public donation tracking
  isPublicDonation?: boolean;
  internalReference?: string | null;

  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Schema
// ============================================================================

const FundraisingDonationSchema = new Schema<IFundraisingDonation>(
  {
    campaignId: { type: Schema.Types.ObjectId, ref: "FundraisingCampaign", required: true, index: true },
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },

    // Amount
    amountMinor: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, default: "GHS" },

    // Status
    status: {
      type: String,
      enum: ["pending", "completed", "failed", "refunded"],
      default: "pending",
    },

    // Donor info
    donorUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    donorName: { type: String, maxlength: 200, default: null },
    donorEmail: { type: String, maxlength: 255, default: null },
    donorPhone: { type: String, maxlength: 50, default: null },
    isAnonymous: { type: Boolean, default: false },
    message: { type: String, maxlength: 1000, default: null },

    // Payment
    paymentMethod: {
      type: String,
      enum: ["cash", "bank_transfer", "mobile_money", "paystack", "stripe", "cheque", "other"],
      required: true,
    },

    // V2: Idempotency fields
    idempotencyKey: { type: String, default: null },
    intentId: { type: String, default: null },
    gatewayReference: { type: String, default: null },
    gatewayTransactionId: { type: String, default: null },
    gatewayEventId: { type: String, default: null },
    gatewayResponse: { type: Schema.Types.Mixed, default: null },

    // Receipt
    receiptNumber: { type: String, default: null },

    // Refund
    refundedAt: { type: Date, default: null },
    refundReason: { type: String, maxlength: 500, default: null },

    // Public donation tracking
    isPublicDonation: { type: Boolean, default: false },
    internalReference: { type: String, default: null },
  },
  { timestamps: true }
);

// ============================================================================
// Indexes
// ============================================================================

// Query indexes
FundraisingDonationSchema.index({ schoolId: 1, campaignId: 1 });
FundraisingDonationSchema.index({ schoolId: 1, status: 1 });
FundraisingDonationSchema.index({ campaignId: 1, createdAt: -1 });

// V2: Unique sparse indexes for idempotency
FundraisingDonationSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });
FundraisingDonationSchema.index({ gatewayReference: 1 }, { unique: true, sparse: true });
FundraisingDonationSchema.index({ gatewayEventId: 1 }, { unique: true, sparse: true });

// ============================================================================
// Export Model
// ============================================================================

export const FundraisingDonation =
  (mongoose.models.FundraisingDonation as mongoose.Model<IFundraisingDonation>) ||
  mongoose.model<IFundraisingDonation>("FundraisingDonation", FundraisingDonationSchema);
