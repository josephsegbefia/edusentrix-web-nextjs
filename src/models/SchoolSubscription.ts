import { Schema, model, models, Types, type Model } from "mongoose";
import type {
  BillingCadence,
  SubscriptionLifecycleMode,
  SubscriptionDiscountMode,
  SubscriptionStatus,
} from "@/lib/platform-billing/subscription-pricing";

/** Typed school-specific overrides — §11.2 */
export interface ISchoolSubscriptionOverrides {
  /** Custom price per student per term in minor units. */
  pricePerStudentPerTermMinor?: number | null;
  /** Custom minimum term fee in minor units. */
  minimumTermFeeMinor?: number | null;
  /** Feature keys to add on top of the plan (Pilot/custom contracts). */
  featuresAdd?: string[];
  /** Feature keys to remove from the plan. */
  featuresRemove?: string[];
  /** Per-limit overrides, e.g. { maxStudents: 200 }. */
  limits?: Record<string, number | null>;
  /** Transaction fee policy snapshot override for this school. */
  transactionFees?: Record<string, unknown> | null;
}

export interface IPendingPlanChange {
  targetTierId: Types.ObjectId;
  targetTierCode: string;
  targetTierName: string;
  targetTierVersion?: number | null;
  changeKind: "downgrade" | "upgrade" | "lateral";
  effectiveAt: Date;
  requestedByEmail?: string | null;
  requestedAt: Date;
  note?: string | null;
  quoteSnapshot?: Record<string, unknown> | null;
}

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
  /**
   * Active student count snapshot captured at assignment/renewal time.
   * Used for billing calculations (§11.2).
   */
  studentCountSnapshot: number;
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
  /** Typed school-specific overrides for pricing, features, and limits. */
  schoolOverrides?: ISchoolSubscriptionOverrides | null;
  pendingPlanChange?: IPendingPlanChange | null;
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
    studentCountSnapshot: { type: Number, required: true, default: 0 },
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
    schoolOverrides: {
      type: new Schema(
        {
          pricePerStudentPerTermMinor: { type: Number, default: null },
          minimumTermFeeMinor: { type: Number, default: null },
          featuresAdd: [{ type: String, trim: true }],
          featuresRemove: [{ type: String, trim: true }],
          limits: { type: Schema.Types.Mixed, default: null },
          transactionFees: { type: Schema.Types.Mixed, default: null },
        },
        { _id: false }
      ),
      default: null,
    },
    pendingPlanChange: {
      type: new Schema(
        {
          targetTierId: {
            type: Schema.Types.ObjectId,
            ref: "SubscriptionTier",
            required: true,
          },
          targetTierCode: { type: String, required: true, trim: true },
          targetTierName: { type: String, required: true, trim: true },
          targetTierVersion: { type: Number, default: null },
          changeKind: {
            type: String,
            enum: ["downgrade", "upgrade", "lateral"],
            required: true,
          },
          effectiveAt: { type: Date, required: true },
          requestedByEmail: { type: String, default: null, trim: true },
          requestedAt: { type: Date, default: () => new Date() },
          note: { type: String, default: null, trim: true },
          quoteSnapshot: { type: Schema.Types.Mixed, default: null },
        },
        { _id: false }
      ),
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
schoolSubscriptionSchema.index({ "pendingPlanChange.effectiveAt": 1 });

export const SchoolSubscription: Model<ISchoolSubscription> =
  (models.SchoolSubscription as Model<ISchoolSubscription>) ||
  model<ISchoolSubscription>("SchoolSubscription", schoolSubscriptionSchema);
