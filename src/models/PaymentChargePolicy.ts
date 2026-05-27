/**
 * PaymentChargePolicy
 *
 * DB-backed transaction fee policies.
 *
 * Precedence (§7.5):
 *   1. school + category
 *   2. school default
 *   3. global category
 *   4. global default
 *   5. no charge
 *
 * chargeType: "percentage" | "fixed" | "hybrid"
 * percentageBps: basis points (100 bps = 1%)
 * payerMode: "payer_pays" | "school_absorbs" | "waived"
 *
 * Spec §11.4, §14.6.
 */

import { Schema, model, models, Types, type Model } from "mongoose";

export type PaymentCategory =
  | "school_fee"
  | "admission_fee"
  | "store_payment"
  | "learn_subscription"
  | "meeting_credit_purchase"
  | "leo_credit_purchase"
  | "storage_addon_purchase"
  | "event_or_trip_payment"
  | "donation_or_fundraising";

export type ChargeType = "percentage" | "fixed" | "hybrid";
export type PayerMode = "payer_pays" | "school_absorbs" | "waived";
export type PolicyScope = "global" | "school" | "category" | "school_category";

export const PAYMENT_CATEGORIES: PaymentCategory[] = [
  "school_fee",
  "admission_fee",
  "store_payment",
  "learn_subscription",
  "meeting_credit_purchase",
  "leo_credit_purchase",
  "storage_addon_purchase",
  "event_or_trip_payment",
  "donation_or_fundraising",
];

export const PAYMENT_CATEGORY_LABELS: Record<PaymentCategory, string> = {
  school_fee: "School fees",
  admission_fee: "Admission fees",
  store_payment: "Store / order payments",
  learn_subscription: "EduSentrix Learn subscriptions",
  meeting_credit_purchase: "Meeting credit purchases",
  leo_credit_purchase: "Leo AI credit purchases",
  storage_addon_purchase: "Storage add-on purchases",
  event_or_trip_payment: "Event / trip payments",
  donation_or_fundraising: "Donations / fundraising",
};

export const PAYER_MODE_LABELS: Record<PayerMode, string> = {
  payer_pays: "Parent / payer pays",
  school_absorbs: "School absorbs",
  waived: "Waived — no platform charge",
};

export interface IPaymentChargePolicy {
  _id: Types.ObjectId;
  scope: PolicyScope;
  schoolId?: Types.ObjectId | null;
  category?: PaymentCategory | null;
  active: boolean;
  chargeType: ChargeType;
  /** Basis points (100 bps = 1%) — used for percentage + hybrid */
  percentageBps?: number | null;
  /** Fixed fee in minor units (e.g. GHS 2 = 200) */
  fixedFeeMinor?: number | null;
  /** Minimum charge minor — floor on the calculated charge */
  minChargeMinor?: number | null;
  /** Maximum cap minor — ceil on the calculated charge */
  maxChargeMinor?: number | null;
  payerMode: PayerMode;
  currency: "GHS";
  description?: string | null;
  createdBy?: Types.ObjectId | null;
  createdByEmail?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const paymentChargePolicySchema = new Schema<IPaymentChargePolicy>(
  {
    scope: {
      type: String,
      enum: ["global", "school", "category", "school_category"],
      required: true,
      index: true,
    },
    schoolId: { type: Schema.Types.ObjectId, ref: "School", default: null, index: true },
    category: {
      type: String,
      enum: [...PAYMENT_CATEGORIES, null],
      default: null,
      index: true,
    },
    active: { type: Boolean, required: true, default: true, index: true },
    chargeType: {
      type: String,
      enum: ["percentage", "fixed", "hybrid"],
      required: true,
      default: "percentage",
    },
    percentageBps: { type: Number, min: 0, max: 10000, default: null },
    fixedFeeMinor: { type: Number, min: 0, default: null },
    minChargeMinor: { type: Number, min: 0, default: null },
    maxChargeMinor: { type: Number, min: 0, default: null },
    payerMode: {
      type: String,
      enum: ["payer_pays", "school_absorbs", "waived"],
      required: true,
      default: "payer_pays",
    },
    currency: { type: String, enum: ["GHS"], default: "GHS" },
    description: { type: String, trim: true, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    createdByEmail: { type: String, trim: true, default: null },
  },
  { timestamps: true }
);

// Compound indexes for fast precedence lookups
paymentChargePolicySchema.index({ scope: 1, active: 1 });
paymentChargePolicySchema.index({ schoolId: 1, category: 1, active: 1 });
paymentChargePolicySchema.index({ scope: 1, category: 1, active: 1 });

export const PaymentChargePolicy: Model<IPaymentChargePolicy> =
  (models.PaymentChargePolicy as Model<IPaymentChargePolicy>) ||
  model<IPaymentChargePolicy>("PaymentChargePolicy", paymentChargePolicySchema);
