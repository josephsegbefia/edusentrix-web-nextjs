import { Schema, model, models, Types, type Model } from "mongoose";

export type PilotCloseoutApprovalStatus =
  | "pending_approval"
  | "approved"
  | "rejected";
export type PilotCloseoutAction =
  | "keep"
  | "raise_price"
  | "assign_price"
  | "review";

export interface IPilotCloseoutRun {
  _id: Types.ObjectId;
  periodStart: Date;
  periodEnd: Date;
  approvalStatus: PilotCloseoutApprovalStatus;
  generatedBy?: Types.ObjectId | null;
  generatedByEmail?: string | null;
  reviewedBy?: Types.ObjectId | null;
  reviewedByEmail?: string | null;
  reviewedAt?: Date | null;
  reviewNote?: string | null;
  aiSummary?: string | null;
  aiModel?: string | null;
  schoolCount: number;
  summary: {
    totalSubscriptionRevenueMinor: number;
    totalTransactionFeeRevenueMinor: number;
    totalRealizedRevenueMinor: number;
    totalEstimatedCostMinor: number;
    totalMarginMinor: number;
    negativeMarginSchools: number;
    targetMarginPercent: number;
  };
  recommendations: Array<{
    schoolId: Types.ObjectId;
    schoolName: string;
    subscriptionId?: Types.ObjectId | null;
    tierName?: string | null;
    subscriptionStatus?: string | null;
    currentSubscriptionPriceMinor: number;
    transactionFeeRevenueMinor: number;
    estimatedCostMinor: number;
    realizedRevenueMinor: number;
    marginMinor: number;
    marginPercent: number;
    recommendedSubscriptionPriceMinor: number;
    recommendedAction: PilotCloseoutAction;
    narrative: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const recommendationSchema = new Schema(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
    },
    schoolName: { type: String, required: true, trim: true },
    subscriptionId: {
      type: Schema.Types.ObjectId,
      ref: "SchoolSubscription",
      default: null,
    },
    tierName: { type: String, default: null, trim: true },
    subscriptionStatus: { type: String, default: null, trim: true },
    currentSubscriptionPriceMinor: { type: Number, required: true, default: 0 },
    transactionFeeRevenueMinor: { type: Number, required: true, default: 0 },
    estimatedCostMinor: { type: Number, required: true, default: 0 },
    realizedRevenueMinor: { type: Number, required: true, default: 0 },
    marginMinor: { type: Number, required: true, default: 0 },
    marginPercent: { type: Number, required: true, default: 0 },
    recommendedSubscriptionPriceMinor: { type: Number, required: true, default: 0 },
    recommendedAction: {
      type: String,
      enum: ["keep", "raise_price", "assign_price", "review"],
      required: true,
      default: "review",
    },
    narrative: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const pilotCloseoutRunSchema = new Schema<IPilotCloseoutRun>(
  {
    periodStart: { type: Date, required: true, index: true },
    periodEnd: { type: Date, required: true, index: true },
    approvalStatus: {
      type: String,
      enum: ["pending_approval", "approved", "rejected"],
      required: true,
      default: "pending_approval",
      index: true,
    },
    generatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    generatedByEmail: { type: String, default: null, trim: true },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reviewedByEmail: { type: String, default: null, trim: true },
    reviewedAt: { type: Date, default: null },
    reviewNote: { type: String, default: null, trim: true },
    aiSummary: { type: String, default: null, trim: true },
    aiModel: { type: String, default: null, trim: true },
    schoolCount: { type: Number, required: true, default: 0 },
    summary: {
      totalSubscriptionRevenueMinor: { type: Number, required: true, default: 0 },
      totalTransactionFeeRevenueMinor: { type: Number, required: true, default: 0 },
      totalRealizedRevenueMinor: { type: Number, required: true, default: 0 },
      totalEstimatedCostMinor: { type: Number, required: true, default: 0 },
      totalMarginMinor: { type: Number, required: true, default: 0 },
      negativeMarginSchools: { type: Number, required: true, default: 0 },
      targetMarginPercent: { type: Number, required: true, default: 25 },
    },
    recommendations: { type: [recommendationSchema], default: [] },
  },
  { timestamps: true }
);

pilotCloseoutRunSchema.index({ createdAt: -1 });
pilotCloseoutRunSchema.index({ approvalStatus: 1, createdAt: -1 });

export const PilotCloseoutRun: Model<IPilotCloseoutRun> =
  (models.PilotCloseoutRun as Model<IPilotCloseoutRun>) ||
  model<IPilotCloseoutRun>("PilotCloseoutRun", pilotCloseoutRunSchema);
