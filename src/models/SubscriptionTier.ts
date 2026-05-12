import { Schema, model, models, Types, type Model } from "mongoose";
import type { BillingCadence } from "@/lib/platform-billing/subscription-pricing";

export interface ISubscriptionTier {
  _id: Types.ObjectId;
  code: string;
  name: string;
  description?: string | null;
  priceMinor: number;
  billingCadence: BillingCadence;
  pricing?: {
    currency?: string;
    pricePerStudentPerTermMinor?: number | null;
    minimumTermFeeMinor?: number | null;
    annualDiscountPercent?: number | null;
    onboardingFeeMinor?: number | null;
  } | null;
  studentLimit?: number | null;
  features: string[];
  limits?: Record<string, number | null> | null;
  transactionFees?: Record<string, unknown> | null;
  trialDefaults?: Record<string, unknown> | null;
  pilotDefaults?: Record<string, unknown> | null;
  publicVisible?: boolean;
  version?: number;
  provisional: boolean;
  active: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const subscriptionTierSchema = new Schema<ISubscriptionTier>(
  {
    code: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: null, trim: true },
    priceMinor: { type: Number, required: true },
    billingCadence: {
      type: String,
      enum: ["term", "annual", "monthly", "custom"],
      default: "term",
      required: true,
    },
    pricing: {
      currency: { type: String, default: "GHS", trim: true },
      pricePerStudentPerTermMinor: { type: Number, default: null },
      minimumTermFeeMinor: { type: Number, default: null },
      annualDiscountPercent: { type: Number, default: null },
      onboardingFeeMinor: { type: Number, default: null },
    },
    studentLimit: { type: Number, default: null },
    features: [{ type: String, trim: true }],
    limits: { type: Schema.Types.Mixed, default: null },
    transactionFees: { type: Schema.Types.Mixed, default: null },
    trialDefaults: { type: Schema.Types.Mixed, default: null },
    pilotDefaults: { type: Schema.Types.Mixed, default: null },
    publicVisible: { type: Boolean, default: false },
    version: { type: Number, default: 1 },
    provisional: { type: Boolean, default: true },
    active: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

subscriptionTierSchema.index({ active: 1, sortOrder: 1 });
subscriptionTierSchema.index({ code: 1, version: 1 });

export const SubscriptionTier: Model<ISubscriptionTier> =
  (models.SubscriptionTier as Model<ISubscriptionTier>) ||
  model<ISubscriptionTier>("SubscriptionTier", subscriptionTierSchema);
