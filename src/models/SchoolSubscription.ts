import { Schema, model, models, Types, type Model } from "mongoose";
import type {
  BillingCadence,
  SubscriptionLifecycleMode,
  SubscriptionDiscountMode,
  SubscriptionStatus,
} from "@/lib/platform-billing/subscription-pricing";

export interface ISchoolSubscription {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  tierId?: Types.ObjectId | null;
  tierCode?: string | null;
  tierName?: string | null;
  tierVersion?: number | null;
  status: SubscriptionStatus;
  lifecycleMode?: SubscriptionLifecycleMode | null;
  billingCadence?: BillingCadence | null;
  startsAt?: Date | null;
  endsAt?: Date | null;
  trialStartsAt?: Date | null;
  trialEndsAt?: Date | null;
  pilotStartsAt?: Date | null;
  pilotEndsAt?: Date | null;
  gracePeriodEndsAt?: Date | null;
  academicYearId?: Types.ObjectId | null;
  academicTermId?: Types.ObjectId | null;
  basePriceMinor: number;
  manualPriceOverrideMinor?: number | null;
  discountMode: SubscriptionDiscountMode;
  discountValue?: number | null;
  effectivePriceMinor: number;
  includedLimitsSnapshot?: Record<string, number | null> | null;
  featuresSnapshot?: string[] | null;
  transactionFeeSnapshot?: Record<string, unknown> | null;
  trialLimitsSnapshot?: Record<string, number | null> | null;
  pilotLimitsSnapshot?: Record<string, number | null> | null;
  usageResetPolicy?: "term" | "annual" | "custom" | null;
  manualAccessModeOverride?:
    | "full"
    | "trial_limited"
    | "pilot_limited"
    | "grace"
    | "restricted_read_only"
    | "suspended"
    | null;
  note?: string | null;
  updatedBy?: Types.ObjectId | null;
  updatedByEmail?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const schoolSubscriptionSchema = new Schema<ISchoolSubscription>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      unique: true,
    },
    tierId: { type: Schema.Types.ObjectId, ref: "SubscriptionTier", default: null },
    tierCode: { type: String, default: null, trim: true },
    tierName: { type: String, default: null, trim: true },
    tierVersion: { type: Number, default: null },
    status: {
      type: String,
      enum: [
        "draft",
        "trial",
        "trialing",
        "pilot",
        "active",
        "past_due",
        "grace",
        "restricted_read_only",
        "suspended",
        "cancelled",
        "expired",
        "archived",
      ],
      default: "draft",
      required: true,
    },
    lifecycleMode: {
      type: String,
      enum: ["trial", "pilot", "paid", "custom", null],
      default: null,
    },
    billingCadence: {
      type: String,
      enum: ["term", "annual", "monthly", "custom", null],
      default: null,
    },
    startsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
    trialStartsAt: { type: Date, default: null },
    trialEndsAt: { type: Date, default: null },
    pilotStartsAt: { type: Date, default: null },
    pilotEndsAt: { type: Date, default: null },
    gracePeriodEndsAt: { type: Date, default: null },
    academicYearId: { type: Schema.Types.ObjectId, ref: "AcademicYear", default: null },
    academicTermId: { type: Schema.Types.ObjectId, ref: "AcademicTerm", default: null },
    basePriceMinor: { type: Number, required: true, default: 0 },
    manualPriceOverrideMinor: { type: Number, default: null },
    discountMode: {
      type: String,
      enum: ["none", "percent", "fixed"],
      default: "none",
      required: true,
    },
    discountValue: { type: Number, default: null },
    effectivePriceMinor: { type: Number, required: true, default: 0 },
    includedLimitsSnapshot: { type: Schema.Types.Mixed, default: null },
    featuresSnapshot: [{ type: String, trim: true }],
    transactionFeeSnapshot: { type: Schema.Types.Mixed, default: null },
    trialLimitsSnapshot: { type: Schema.Types.Mixed, default: null },
    pilotLimitsSnapshot: { type: Schema.Types.Mixed, default: null },
    usageResetPolicy: {
      type: String,
      enum: ["term", "annual", "custom", null],
      default: null,
    },
    manualAccessModeOverride: {
      type: String,
      enum: [
        "full",
        "trial_limited",
        "pilot_limited",
        "grace",
        "restricted_read_only",
        "suspended",
        null,
      ],
      default: null,
    },
    note: { type: String, default: null, trim: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    updatedByEmail: { type: String, default: null, trim: true },
  },
  { timestamps: true }
);

schoolSubscriptionSchema.index({ status: 1 });
schoolSubscriptionSchema.index({ schoolId: 1, status: 1 });
schoolSubscriptionSchema.index({ endsAt: 1 });
schoolSubscriptionSchema.index({ trialEndsAt: 1 });
schoolSubscriptionSchema.index({ pilotEndsAt: 1 });
schoolSubscriptionSchema.index({ gracePeriodEndsAt: 1 });

export const SchoolSubscription: Model<ISchoolSubscription> =
  (models.SchoolSubscription as Model<ISchoolSubscription>) ||
  model<ISchoolSubscription>("SchoolSubscription", schoolSubscriptionSchema);
